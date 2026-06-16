import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { inspectModels, runBenchmark } from './bench.js';
import { diffReports, renderCompareReport } from './compare.js';
import { runProcess } from './process.js';
import { createProgress } from './progress.js';
import { flattenResults, toCsv, writeReport } from './report.js';
import { legendEntries, renderBenchmarkReport, renderLegend, renderModelsTable } from './table.js';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

export async function runCli(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv);

  if (parsed.help) {
    console.log(helpText());
    return;
  }

  if (parsed.versionOnly) {
    console.log(packageJson.version);
    return;
  }

  if (parsed.command === 'legend') {
    if (parsed.format === 'json') {
      console.log(JSON.stringify(legendEntries(), null, 2));
    } else if (parsed.format === 'csv') {
      console.log(toCsv(legendEntries()));
    } else {
      console.log(renderLegend(renderOptions(parsed)));
    }
    return;
  }

  if (parsed.command === 'doctor') {
    await runDoctor(parsed);
    return;
  }

  if (parsed.command === 'compare') {
    await runCompare(parsed, renderOptions(parsed));
    return;
  }

  if (parsed.command === 'models') {
    const inspection = await inspectModels(parsed);
    if (parsed.format === 'json') {
      console.log(JSON.stringify(inspection.models, null, 2));
    } else {
      console.log(renderModelsTable(inspection.models, renderOptions(parsed)));
    }
    return;
  }

  if (parsed.ci) {
    if (parsed.color === 'auto') parsed.color = 'never';
    if (parsed.progress === 'auto') parsed.progress = 'never';
  }

  const progress = createProgress({
    ...renderOptions(parsed),
    enabled: resolveProgress(parsed),
    stream: process.stderr
  });
  let payload;
  try {
    payload = await runBenchmark({
      ...parsed,
      version: packageJson.version,
      onProgress: (event) => progress.update(event)
    });
  } finally {
    progress.stop();
  }

  if (parsed.format === 'json') {
    console.log(JSON.stringify(payload, null, 2));
  } else if (parsed.format === 'csv') {
    console.log(toCsv(flattenResults(payload.results)));
  } else {
    console.log(renderBenchmarkReport(payload, renderOptions(parsed)));
    if (parsed.verbose) {
      console.log();
      console.log(toCsv(flattenResults(payload.results)));
    }
  }

  if (parsed.out) {
    const reportFormat = parsed.out.endsWith('.csv') ? 'csv' : 'json';
    const written = await writeReport(parsed.out, payload, reportFormat);
    if (parsed.format !== 'json') {
      console.error(`Saved ${reportFormat.toUpperCase()} report to ${written}`);
    }
  }

  if (parsed.outputDir) {
    const stamp = payload.startedAt.replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
    const firstModel = parsed.models?.flatMap((m) => String(m).split(',')).map((m) => m.trim()).filter(Boolean)[0] || 'all';
    const modelSlug = firstModel.replace(/[^a-z0-9]/gi, '_');
    const filename = `fm-bench_${stamp}_${modelSlug}.json`;
    const filePath = `${parsed.outputDir}/${filename}`;
    const written = await writeReport(filePath, payload, 'json');
    if (parsed.format !== 'json') {
      console.error(`Saved JSON report to ${written}`);
    }
  }

  if (parsed.ci) {
    const ciResult = evaluateCi(payload);
    if (!ciResult.passed) {
      const reasons = ciResult.reasons.join('; ');
      console.error(`fm-bench ci: FAIL — ${reasons}`);
      const error = new Error(`CI checks failed: ${reasons}`);
      error.exitCode = 1;
      throw error;
    }
    console.error(`fm-bench ci: PASS`);
  }
}

function evaluateCi(payload) {
  const reasons = [];
  const totalFailed = payload.summary.reduce((sum, item) => sum + item.failures, 0);
  if (totalFailed > 0) {
    reasons.push(`${totalFailed} run(s) failed`);
  }

  const hasSlo = payload.options?.slo && (
    payload.options.slo.ttftMs || payload.options.slo.e2eMs || payload.options.slo.tpotMs
  );
  if (hasSlo) {
    for (const item of payload.summary) {
      if (!item.available) continue;
      if (item.goodputRate != null && item.goodputRate < 1) {
        const pct = Math.round((1 - item.goodputRate) * 100);
        reasons.push(`${item.model} c${item.concurrency ?? 1}: ${pct}% of runs violated SLO`);
      }
    }
  }

  return {
    passed: reasons.length === 0,
    reasons
  };
}

export function parseArgs(argv) {
  const options = {
    command: 'run',
    compareFiles: [],
    models: [],
    prompts: [],
    runs: 1,
    warmup: 0,
    concurrency: 1,
    sweepConcurrency: [],
    requestRate: null,
    rampUpMs: 0,
    timeoutMs: 60_000,
    profile: 'standard',
    greedy: true,
    stream: true,
    sloTtftMs: null,
    sloE2eMs: null,
    sloTpotMs: null,
    format: 'table',
    captureOutput: false,
    availableOnly: false,
    failFast: false,
    retry: 0,
    ci: false,
    tags: [],
    note: null,
    verbose: false,
    ascii: false,
    color: 'auto',
    progress: 'auto',
    compact: false,
    width: null
  };

  const args = [...argv];
  if (args[0] && !args[0].startsWith('-') && ['run', 'models', 'doctor', 'legend', 'metrics', 'compare', 'help'].includes(args[0])) {
    options.command = args.shift();
  }

  if (options.command === 'metrics') {
    options.command = 'legend';
  }

  if (options.command === 'help') {
    options.help = true;
    return options;
  }

  while (args.length > 0) {
    const arg = args.shift();
    switch (arg) {
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '--version':
        options.versionOnly = true;
        break;
      case '-m':
      case '--model':
      case '--models':
        options.models.push(requireValue(arg, args));
        break;
      case '-r':
      case '--runs':
        options.runs = parsePositiveInt(requireValue(arg, args), arg);
        break;
      case '--warmup':
        options.warmup = parseNonNegativeInt(requireValue(arg, args), arg);
        break;
      case '-c':
      case '--concurrency':
        options.concurrency = parsePositiveInt(requireValue(arg, args), arg);
        break;
      case '--sweep-concurrency':
        options.sweepConcurrency = parsePositiveIntList(requireValue(arg, args), arg);
        if (options.sweepConcurrency.length > 0) {
          options.concurrency = options.sweepConcurrency[0];
        }
        break;
      case '--request-rate':
        options.requestRate = parsePositiveNumber(requireValue(arg, args), arg);
        break;
      case '--ramp-up-ms':
        options.rampUpMs = parseNonNegativeInt(requireValue(arg, args), arg);
        break;
      case '--timeout':
      case '--timeout-ms':
        options.timeoutMs = parsePositiveInt(requireValue(arg, args), arg);
        break;
      case '--slo-ttft-ms':
        options.sloTtftMs = parsePositiveInt(requireValue(arg, args), arg);
        break;
      case '--slo-e2e-ms':
        options.sloE2eMs = parsePositiveInt(requireValue(arg, args), arg);
        break;
      case '--slo-tpot-ms':
        options.sloTpotMs = parsePositiveInt(requireValue(arg, args), arg);
        break;
      case '-p':
      case '--prompt':
        options.prompts.push(requireValue(arg, args));
        break;
      case '--prompt-file':
        options.promptFile = requireValue(arg, args);
        break;
      case '--profile':
        options.profile = requireValue(arg, args);
        if (!['quick', 'standard', 'interactive', 'throughput', 'client', 'stress', 'reasoning', 'coding', 'creative'].includes(options.profile)) {
          throw new Error(`--profile must be one of: quick, standard, interactive, throughput, client, stress, reasoning, coding, creative`);
        }
        break;
      case '-i':
      case '--instructions':
        options.instructions = requireValue(arg, args);
        break;
      case '--fm-bin':
        options.fmBin = requireValue(arg, args);
        break;
      case '--use-case':
        options.useCase = requireValue(arg, args);
        break;
      case '--guardrails':
        options.guardrails = requireValue(arg, args);
        break;
      case '--greedy':
        options.greedy = true;
        break;
      case '--no-greedy':
        options.greedy = false;
        break;
      case '--stream':
        options.stream = true;
        break;
      case '--no-stream':
        options.stream = false;
        break;
      case '--json':
        options.format = 'json';
        break;
      case '--csv':
        options.format = 'csv';
        break;
      case '--format':
        options.format = requireValue(arg, args);
        if (!['table', 'json', 'csv'].includes(options.format)) {
          throw new Error('--format must be one of: table, json, csv');
        }
        break;
      case '--ascii':
        options.ascii = true;
        break;
      case '--color':
        options.color = 'always';
        break;
      case '--no-color':
        options.color = 'never';
        break;
      case '--progress':
        options.progress = 'always';
        break;
      case '--no-progress':
        options.progress = 'never';
        break;
      case '--compact':
        options.compact = true;
        break;
      case '--width':
        options.width = parsePositiveInt(requireValue(arg, args), arg);
        break;
      case '-o':
      case '--out':
        options.out = requireValue(arg, args);
        break;
      case '--output-dir':
        options.outputDir = requireValue(arg, args);
        break;
      case '--capture-output':
        options.captureOutput = true;
        break;
      case '--available-only':
        options.availableOnly = true;
        break;
      case '--fail-fast':
        options.failFast = true;
        break;
      case '--retry':
        options.retry = parseNonNegativeInt(requireValue(arg, args), arg);
        break;
      case '--ci':
        options.ci = true;
        break;
      case '--tag':
        options.tags.push(requireValue(arg, args));
        break;
      case '--note':
        options.note = requireValue(arg, args);
        break;
      case '-v':
      case '--verbose':
        options.verbose = true;
        break;
      case '--':
        if (args.length > 0) {
          options.prompts.push(args.join(' '));
          args.length = 0;
        }
        break;
      default:
        if (arg.startsWith('-')) {
          throw new Error(`Unknown option: ${arg}`);
        }
        if (options.command === 'compare') {
          options.compareFiles.push(arg);
        } else {
          options.prompts.push([arg, ...args].join(' '));
          args.length = 0;
        }
        break;
    }
  }

  return options;
}

async function runCompare(options, renderOpts) {
  const files = options.compareFiles;
  if (files.length < 2) {
    throw new Error('compare requires two JSON report files: fm-bench compare before.json after.json');
  }
  if (files.length > 2) {
    throw new Error('compare accepts exactly two JSON report files');
  }

  const [beforePath, afterPath] = files;
  const [beforeText, afterText] = await Promise.all([
    fs.readFile(beforePath, 'utf8'),
    fs.readFile(afterPath, 'utf8')
  ]);

  let before, after;
  try {
    before = JSON.parse(beforeText);
  } catch {
    throw new Error(`Cannot parse ${beforePath} as JSON`);
  }
  try {
    after = JSON.parse(afterText);
  } catch {
    throw new Error(`Cannot parse ${afterPath} as JSON`);
  }

  const diff = diffReports(before, after);

  if (options.format === 'json') {
    console.log(JSON.stringify(diff, null, 2));
  } else {
    console.log(renderCompareReport(diff, renderOpts));
  }

  if (options.out) {
    await fs.writeFile(options.out, `${JSON.stringify(diff, null, 2)}\n`, 'utf8');
    console.error(`Saved compare report to ${options.out}`);
  }
}

async function runDoctor(options) {
  const checks = [];
  checks.push(['node', process.version, true]);
  checks.push(['platform', `${process.platform}/${process.arch}`, process.platform === 'darwin']);

  const swVers = await runProcess('sw_vers', [], { timeoutMs: 5_000 });
  const macOS = swVers.stdout || swVers.stderr;
  const versionMatch = macOS.match(/ProductVersion:\s*([0-9.]+)/);
  const major = versionMatch ? Number.parseInt(versionMatch[1].split('.')[0], 10) : null;
  checks.push(['macOS', versionMatch?.[1] || 'unknown', major == null || major >= 27]);

  const hwModel = await runProcess('sysctl', ['-n', 'hw.model'], { timeoutMs: 3_000 });
  const hwModelStr = (hwModel.stdout || '').trim();
  if (hwModelStr) checks.push(['hw.model', hwModelStr, true]);

  const cpuBrand = await runProcess('sysctl', ['-n', 'machdep.cpu.brand_string'], { timeoutMs: 3_000 });
  const cpuBrandStr = (cpuBrand.stdout || '').trim();
  if (cpuBrandStr) checks.push(['cpu', cpuBrandStr, true]);

  const memBytes = await runProcess('sysctl', ['-n', 'hw.memsize'], { timeoutMs: 3_000 });
  const memRaw = (memBytes.stdout || '').trim();
  if (memRaw) {
    const gb = (Number(memRaw) / (1024 ** 3)).toFixed(0);
    checks.push(['memory', `${gb} GB`, true]);
  }

  const thermalResult = await runProcess('pmset', ['-g', 'therm'], { timeoutMs: 5_000 });
  const thermalOut = (thermalResult.stdout || thermalResult.stderr || '').trim();
  const thermalMatch = thermalOut.match(/CPU_Scheduler_Limit\s*=\s*(\d+)/);
  if (thermalMatch) {
    const limit = Number.parseInt(thermalMatch[1], 10);
    checks.push(['thermal limit', `${limit}%`, limit >= 100]);
  }

  const batteryResult = await runProcess('pmset', ['-g', 'batt'], { timeoutMs: 5_000 });
  const batteryOut = (batteryResult.stdout || '').trim();
  const batteryLine = batteryOut.split('\n').find((line) => line.includes('%'));
  if (batteryLine) {
    const pctMatch = batteryLine.match(/(\d+)%/);
    const charging = /charging|AC Power|charged/i.test(batteryLine);
    const pct = pctMatch ? `${pctMatch[1]}%` : '?%';
    checks.push(['battery', `${pct}${charging ? ' (charging/AC)' : ' (battery)'}`, charging || Number.parseInt(pctMatch?.[1], 10) >= 20]);
  }

  const inspection = await inspectModels(options);
  checks.push(['fm', inspection.fmBin, inspection.models.length > 0]);
  for (const model of inspection.models) {
    checks.push([`model:${model.name}`, model.available ? 'available' : model.reason || 'unavailable', model.available]);
  }

  const lines = checks.map(([name, detail, ok]) => `${ok ? 'ok  ' : 'warn'} ${name.padEnd(16)} ${String(detail).replace(/\s+/g, ' ').trim()}`);
  console.log(lines.join('\n'));

  if (options.out) {
    await fs.writeFile(options.out, `${JSON.stringify({ checks, models: inspection.models }, null, 2)}\n`, 'utf8');
  }
}

function requireValue(option, args) {
  const value = args.shift();
  if (value == null || value === '') throw new Error(`${option} requires a value`);
  return value;
}

function parsePositiveInt(value, option) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${option} must be a positive integer`);
  return parsed;
}

function parsePositiveNumber(value, option) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${option} must be a positive number`);
  return parsed;
}

function parseNonNegativeInt(value, option) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${option} must be a non-negative integer`);
  return parsed;
}

function parsePositiveIntList(value, option) {
  const parsed = String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => parsePositiveInt(item, option));
  if (parsed.length === 0) throw new Error(`${option} requires at least one positive integer`);
  return parsed;
}

function renderOptions(parsed) {
  return {
    ascii: parsed.ascii,
    color: resolveColor(parsed.color),
    compact: parsed.compact,
    width: parsed.width
  };
}

function resolveColor(value) {
  if (value === 'always') return true;
  if (value === 'never') return false;
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== '0') return true;
  return Boolean(process.stdout.isTTY);
}

function resolveProgress(parsed) {
  if (parsed.progress === 'always') return true;
  if (parsed.progress === 'never') return false;
  return parsed.format === 'table' ? 'auto' : false;
}

function helpText() {
  return `fm-bench ${packageJson.version}

Dynamic benchmark CLI for Apple's fm command on macOS 27+.

Usage:
  fm-bench [run] [options]
  fm-bench models [options]
  fm-bench compare <before.json> <after.json> [options]
  fm-bench legend [options]
  fm-bench doctor [options]

Commands:
  run                  Benchmark discovered or selected fm models
  models               List discovered models and availability
  compare              Compare two saved JSON reports and show metric deltas
  legend               Explain every terminal table column and color rule
  doctor               Check Node, macOS, fm, and model availability

Run options:
  -m, --models <list>       Models to benchmark, comma-separated or repeated
  -r, --runs <n>            Runs per prompt/model (default: 1)
      --warmup <n>          Warmup runs per model before measurement
  -c, --concurrency <n>     Parallel fm processes (default: 1)
      --sweep-concurrency <list>
                            Run separate operating points, e.g. 1,2,4
      --request-rate <rps>  Pace request starts at a target requests/sec
      --ramp-up-ms <n>      Gradually ramp request pacing over n ms
      --timeout-ms <n>      Timeout per fm call in ms (default: 60000)
      --slo-ttft-ms <n>     Count request as good only if TTFT is <= n
      --slo-e2e-ms <n>      Count request as good only if E2E latency is <= n
      --slo-tpot-ms <n>     Count request as good only if TPOT is <= n
  -p, --prompt <text>       Prompt to benchmark; repeatable
      --prompt-file <file>  .json, .jsonl, or blank-line separated text prompts
      --profile <name>      quick, standard, interactive, throughput, client, stress, reasoning, coding, or creative
  -i, --instructions <text> Instructions passed to fm respond
      --use-case <case>     Pass a system model use case through to fm
      --guardrails <level>  Pass a system model guardrail level through to fm
      --greedy              Use greedy sampling (default)
      --no-greedy           Do not request greedy sampling
      --stream              Stream responses while measuring TTFT (default)
      --no-stream           Disable streaming; TTFT fields will be blank
      --available-only      Hide unavailable discovered models
      --capture-output      Include raw model output in JSON reports
      --fail-fast           Stop after the first failed measured run
      --retry <n>           Retry failed fm calls up to n times with exponential backoff
      --ci                  Exit 1 if any run fails or any SLO is violated; disables color and progress
      --tag <name>          Tag this run; repeatable; included in JSON payload and report header
      --note <text>         Freeform note included in JSON payload and report header

Output:
      --format <type>       table, json, or csv (default: table)
      --json                Alias for --format json
      --csv                 Alias for --format csv
      --ascii               Use plain ASCII tables instead of Unicode
      --color               Force ANSI colors in table output
      --no-color            Disable ANSI colors in table output
      --progress            Force live progress on stderr
      --no-progress         Disable live progress on stderr
      --compact             Force compact terminal layout
      --width <n>           Render for a specific terminal width
  -o, --out <file>          Save JSON or CSV report based on file extension
      --output-dir <dir>    Save a timestamped JSON report to a directory automatically
  -v, --verbose             Include per-run CSV after the summary table

Environment:
      --fm-bin <path>       fm binary to execute (default: FM_BIN or fm)
  -h, --help                Show this help
      --version             Print version

Examples:
  fm-bench
  fm-bench --models system,pcc --runs 3 --profile stress
  fm-bench --profile client --sweep-concurrency 1,2 --request-rate 0.5
  fm-bench --prompt "Reply with exactly: ok" --json --out bench.json
  fm-bench --profile reasoning --runs 5 --retry 2
  fm-bench compare before.json after.json
  fm-bench compare before.json after.json --json
  fm-bench legend
  fm-bench models
  fm-bench doctor
`;
}
