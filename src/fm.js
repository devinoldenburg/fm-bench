import os from 'node:os';
import { stripAnsi } from './ansi.js';
import { detectFmCapabilities } from './capabilities.js';
import { firstLine, isUnsupportedModelError, parseAvailabilityOutput } from './fm-help.js';
import { runProcess } from './process.js';
import { parseBatteryOutput, parseThermalOutput } from './system.js';

export { parseModelsFromHelp, parseAvailabilityOutput } from './fm-help.js';

export function fmBinaryFromOptions(options = {}) {
  return options.fmBin || process.env.FM_BIN || 'fm';
}

export async function getFmHelp(fmBin, timeoutMs = 10_000) {
  const result = await runProcess(fmBin, ['--help'], { timeoutMs });
  if (result.error) {
    const error = new Error(`Unable to execute ${fmBin}: ${result.stderr || result.error.message}`);
    error.exitCode = 2;
    throw error;
  }
  return {
    ok: result.code === 0,
    text: `${result.stdout}${result.stderr}`,
    result
  };
}

/**
 * Discover models, preferring an already-detected capability probe so a run
 * does not spawn `fm --help` more than once.
 * @param {Record<string, any>} options
 */
export async function discoverModels(options = {}) {
  const fmBin = fmBinaryFromOptions(options);
  const capabilities = options.capabilities ?? await detectFmCapabilities(fmBin, options);
  return {
    fmBin,
    models: capabilities.models,
    help: capabilities.help,
    capabilities
  };
}

/**
 * Check one model against the detected `fm` build.
 *
 * Models the build does not expose are reported as unsupported without
 * spawning `fm` at all, so a raw argument-error blob from `fm` can never end
 * up in a report or in `fm-bench models` output.
 */
export async function checkModelAvailability(fmBin, model, options = {}) {
  const capabilities = options.capabilities;
  const known = capabilities?.models?.map((entry) => entry.name) ?? [];
  if (capabilities && known.length > 0 && !known.includes(model)) {
    return {
      model,
      available: false,
      unsupported: true,
      raw: '',
      reason: `not supported by this fm build (supported: ${known.join(', ')})`
    };
  }

  const result = await runProcess(fmBin, ['available', '--model', model], {
    timeoutMs: options.timeoutMs ?? 15_000
  });
  const output = `${result.stdout}${result.stderr}`;
  const parsed = parseAvailabilityOutput(model, output, result.code);
  if (result.error) {
    parsed.available = false;
    parsed.reason = result.stderr || result.error.message;
    return parsed;
  }
  if (isUnsupportedModelError(output)) {
    parsed.available = false;
    parsed.unsupported = true;
    const supported = known.length > 0 ? ` (supported: ${known.join(', ')})` : '';
    parsed.reason = `not supported by this fm build${supported}`;
  }
  return parsed;
}

/**
 * Query quota information when the build exposes it.
 * @returns {Promise<{ model: string, supported: boolean, ok: boolean, raw: string, reason: string }>}
 */
export async function getQuotaUsage(fmBin, model, options = {}) {
  const features = options.capabilities?.features;
  if (features && !features.quota) {
    return {
      model,
      supported: false,
      ok: false,
      raw: '',
      reason: 'unavailable: this fm build exposes no quota command'
    };
  }

  const result = await runProcess(fmBin, ['quota-usage', '--model', model], {
    timeoutMs: options.timeoutMs ?? 15_000
  });
  const output = stripAnsi(`${result.stdout}${result.stderr}`).trim();
  return {
    model,
    supported: true,
    ok: result.code === 0,
    raw: output,
    reason: result.code === 0 ? '' : firstLine(output)
  };
}

/**
 * Count tokens with whichever token-counting command this `fm` build exposes.
 * Returns `ok: false` with a reason when the build cannot count tokens; it
 * never invents a count.
 */
export async function countTokens(fmBin, text, options = {}) {
  const command = options.capabilities?.features?.tokenCountCommand ?? 'count-tokens';
  const supported = options.capabilities?.features?.tokenCounting ?? true;
  if (!supported || !command) {
    return {
      ok: false,
      count: null,
      unsupported: true,
      raw: '',
      reason: 'token counting is unavailable in this fm build'
    };
  }

  const result = await runProcess(fmBin, [command, '--quiet'], {
    input: text,
    timeoutMs: options.timeoutMs ?? 15_000
  });
  const output = stripAnsi(`${result.stdout}${result.stderr}`).trim();
  const match = output.match(/\d+/);
  if (result.error || result.code !== 0 || !match) {
    return {
      ok: false,
      count: null,
      raw: output,
      reason: result.error?.message || firstLine(output) || `fm ${command} exited with code ${result.code}`
    };
  }
  return {
    ok: true,
    count: Number.parseInt(match[0], 10),
    raw: output,
    reason: ''
  };
}

export async function respond(fmBin, model, prompt, options = {}) {
  const features = options.capabilities?.features;
  const streamControl = features ? features.streaming : true;
  const modelSelection = features ? features.modelSelection : true;
  const streamed = streamControl && options.stream !== false;

  const args = ['respond'];
  if (modelSelection) args.push('--model', model);
  if (streamControl && !streamed) args.push('--no-stream');
  if (options.greedy && (features?.greedy ?? true)) args.push('--greedy');
  if (options.instructions && (features?.instructions ?? true)) args.push('--instructions', options.instructions);
  if (options.useCase && (features?.useCase ?? true)) args.push('--use-case', options.useCase);
  if (options.guardrails && (features?.guardrails ?? true)) args.push('--guardrails', options.guardrails);

  const result = await runProcess(fmBin, args, {
    input: prompt,
    timeoutMs: options.timeoutMs ?? 60_000
  });

  const output = stripAnsi(result.stdout).trim();
  const errorText = stripAnsi(result.stderr).trim();
  const failed = result.code !== 0 || result.timedOut;

  return {
    ok: !failed,
    model,
    prompt,
    output,
    stderr: errorText,
    code: result.code,
    signal: result.signal,
    timedOut: result.timedOut,
    durationMs: result.durationMs,
    firstOutputMs: streamed ? result.firstStdoutMs : null,
    streamed,
    stdoutChunks: result.stdoutChunks,
    stdoutChunkTimesMs: streamed ? result.stdoutChunkTimesMs : [],
    error: failed
      ? (result.timedOut
        ? `timed out after ${options.timeoutMs ?? 60_000}ms`
        : firstLine(errorText) || `fm exited with code ${result.code ?? result.signal}`)
      : ''
  };
}

export async function collectEnvironment(fmBin, options = {}) {
  const capabilities = options.capabilities;
  const swVers = await runProcess('sw_vers', [], { timeoutMs: 5_000 });
  const macOS = stripAnsi(swVers.stdout).trim() || null;

  const hwModel = await runProcess('sysctl', ['-n', 'hw.model'], { timeoutMs: 3_000 });
  const cpuBrand = await runProcess('sysctl', ['-n', 'machdep.cpu.brand_string'], { timeoutMs: 3_000 });
  const memBytes = await runProcess('sysctl', ['-n', 'hw.memsize'], { timeoutMs: 3_000 });

  const thermalResult = await runProcess('pmset', ['-g', 'therm'], { timeoutMs: 5_000 });
  const thermal = parseThermalOutput(`${thermalResult.stdout || ''}${thermalResult.stderr || ''}`);
  const batteryResult = await runProcess('pmset', ['-g', 'batt'], { timeoutMs: 5_000 });
  const battery = parseBatteryOutput(`${batteryResult.stdout || ''}${batteryResult.stderr || ''}`);

  let fmHelpDigest = capabilities?.digest ?? null;
  if (fmHelpDigest == null) {
    try {
      const help = await getFmHelp(fmBin, 10_000);
      const detected = await detectFmCapabilities(fmBin, { help: { text: help.text } });
      fmHelpDigest = detected.digest;
    } catch {
      fmHelpDigest = null;
    }
  }

  const memRaw = (memBytes.stdout || '').trim();
  const memoryGb = memRaw && Number.isFinite(Number(memRaw))
    ? Math.round(Number(memRaw) / (1024 ** 3))
    : null;

  return {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    host: os.hostname(),
    fmBin,
    macOS,
    hwModel: (hwModel.stdout || '').trim() || null,
    cpuBrand: (cpuBrand.stdout || '').trim() || null,
    memoryGb,
    fmHelpDigest,
    thermal: thermal.available
      ? {
        schedulerLimit: thermal.schedulerLimit,
        healthyIdle: Boolean(thermal.healthyIdle)
      }
      : null,
    power: battery.present
      ? {
        pct: battery.pct,
        onAC: battery.onAC
      }
      : null
  };
}
