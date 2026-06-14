import os from 'node:os';
import { stripAnsi } from './ansi.js';
import { runProcess } from './process.js';

const DEFAULT_MODELS = [
  { name: 'system', description: 'On-device Apple Foundation Model' },
  { name: 'pcc', description: 'Apple Foundation Model on Private Cloud Compute' }
];

export function fmBinaryFromOptions(options = {}) {
  return options.fmBin || process.env.FM_BIN || 'fm';
}

export function parseModelsFromHelp(helpText) {
  const clean = stripAnsi(helpText);
  const lines = clean.split(/\r?\n/);
  const models = new Map();
  let inModels = false;

  for (const line of lines) {
    if (/^\s*MODELS\s*$/.test(line)) {
      inModels = true;
      continue;
    }

    if (inModels && /^\s*[A-Z][A-Z -]+\s*$/.test(line) && !/^\s*MODELS\s*$/.test(line)) {
      inModels = false;
    }

    if (inModels) {
      const match = line.match(/^\s*([A-Za-z0-9._:-]+)\s{2,}(.+?)\s*$/);
      if (match) {
        models.set(match[1], {
          name: match[1],
          description: match[2].replace(/\s*\(default\)\s*$/, '').trim()
        });
      }
    }

    const optionMatch = /--model\b/.test(line)
      ? line.match(/\bmodel\b.*?\(([^)]+)\)/i)
      : null;
    if (optionMatch) {
      for (const raw of optionMatch[1].split(',')) {
        const name = raw.trim();
        if (/^[A-Za-z0-9._:-]+$/.test(name) && !models.has(name)) {
          models.set(name, { name, description: '' });
        }
      }
    }
  }

  return [...models.values()];
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

export async function discoverModels(options = {}) {
  const fmBin = fmBinaryFromOptions(options);
  const help = await getFmHelp(fmBin, options.timeoutMs ?? 10_000);
  let models = parseModelsFromHelp(help.text);

  if (models.length === 0 && /Apple Foundation Models CLI/i.test(stripAnsi(help.text))) {
    models = DEFAULT_MODELS;
  }

  return {
    fmBin,
    models,
    help: stripAnsi(help.text)
  };
}

export function parseAvailabilityOutput(model, output, code) {
  const clean = stripAnsi(output).trim();
  const lower = clean.toLowerCase();
  const modelLower = model.toLowerCase();
  const hasError = /\berror:|\bunavailable\b|\bnot available\b|\bnot supported\b/.test(lower);
  const hasAvailable = new RegExp(`\\b${escapeRegExp(modelLower)}\\b[\\s\\S]{0,80}\\bavailable\\b|\\bavailable\\b[\\s\\S]{0,80}\\b${escapeRegExp(modelLower)}\\b`).test(lower)
    || lower.includes(`${modelLower} model available`)
    || lower.includes(`${titleCase(modelLower)} model available`.toLowerCase());

  return {
    model,
    available: code === 0 && hasAvailable && !hasError,
    raw: clean,
    reason: hasError ? clean : ''
  };
}

export async function checkModelAvailability(fmBin, model, options = {}) {
  const result = await runProcess(fmBin, ['available', '--model', model], {
    timeoutMs: options.timeoutMs ?? 15_000
  });
  const output = `${result.stdout}${result.stderr}`;
  const parsed = parseAvailabilityOutput(model, output, result.code);
  if (result.error) {
    parsed.available = false;
    parsed.reason = result.stderr || result.error.message;
  }
  return parsed;
}

export async function getQuotaUsage(fmBin, model, options = {}) {
  const result = await runProcess(fmBin, ['quota-usage', '--model', model], {
    timeoutMs: options.timeoutMs ?? 15_000
  });
  const output = stripAnsi(`${result.stdout}${result.stderr}`).trim();
  return {
    model,
    ok: result.code === 0,
    raw: output,
    unavailable: /\bunavailable\b|\bnot available\b|\berror:/i.test(output)
  };
}

export async function countTokens(fmBin, text, options = {}) {
  const result = await runProcess(fmBin, ['token-count', '--quiet'], {
    input: text,
    timeoutMs: options.timeoutMs ?? 15_000
  });
  const output = stripAnsi(`${result.stdout}${result.stderr}`).trim();
  const match = output.match(/-?\d+/);
  if (result.code !== 0 || !match) {
    return {
      ok: false,
      count: null,
      raw: output
    };
  }
  return {
    ok: true,
    count: Number.parseInt(match[0], 10),
    raw: output
  };
}

export async function respond(fmBin, model, prompt, options = {}) {
  const args = ['respond', '--model', model];
  const streamed = options.stream !== false;

  if (!streamed) args.push('--no-stream');
  if (options.greedy) args.push('--greedy');
  if (options.instructions) args.push('--instructions', options.instructions);
  if (options.useCase) args.push('--use-case', options.useCase);
  if (options.guardrails) args.push('--guardrails', options.guardrails);

  const result = await runProcess(fmBin, args, {
    input: prompt,
    timeoutMs: options.timeoutMs ?? 60_000
  });

  const output = stripAnsi(result.stdout).trim();
  const errorText = stripAnsi(result.stderr).trim();
  return {
    ok: result.code === 0 && !result.timedOut,
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
    stdoutChunkTimesMs: streamed ? result.stdoutChunkTimesMs : []
  };
}

export async function collectEnvironment(fmBin) {
  const swVers = await runProcess('sw_vers', [], { timeoutMs: 5_000 });
  return {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    host: os.hostname(),
    fmBin,
    macOS: stripAnsi(swVers.stdout).trim() || null
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function titleCase(value) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}
