import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { inspectModels, runBenchmark } from './bench.js';
import { runProcess } from './process.js';
import { flattenResults, toCsv, writeReport } from './report.js';
import { renderBenchmarkReport, renderModelsTable } from './table.js';

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

  if (parsed.command === 'doctor') {
    await runDoctor(parsed);
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

  const payload = await runBenchmark({
    ...parsed,
    version: packageJson.version
  });

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
}

export function parseArgs(argv) {
  const options = {
    command: 'run',
    models: [],
    prompts: [],
    runs: 1,
    warmup: 0,
    concurrency: 1,
    sweepConcurrency: [],
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
    verbose: false,
    ascii: false,
    compact: false,
    width: null
  };

  const args = [...argv];
  if (args[0] && !args[0].startsWith('-') && ['run', 'models', 'doctor', 'help'].includes(args[0])) {
    options.command = args.shift();
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
      case '--capture-output':
        options.captureOutput = true;
        break;
      case '--available-only':
        options.availableOnly = true;
        break;
      case '--fail-fast':
        options.failFast = true;
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
        options.prompts.push([arg, ...args].join(' '));
        args.length = 0;
        break;
    }
  }

  return options;
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

  const inspection = await inspectModels(options);
  checks.push(['fm', inspection.fmBin, inspection.models.length > 0]);
  for (const model of inspection.models) {
    checks.push([`model:${model.name}`, model.available ? 'available' : model.reason || 'unavailable', model.available]);
  }

  const lines = checks.map(([name, detail, ok]) => `${ok ? 'ok  ' : 'warn'} ${name.padEnd(14)} ${String(detail).replace(/\s+/g, ' ').trim()}`);
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
    compact: parsed.compact,
    width: parsed.width
  };
}

function helpText() {
  return `fm-bench ${packageJson.version}

Dynamic benchmark CLI for Apple's fm command on macOS 27+.

Usage:
  fm-bench [run] [options]
  fm-bench models [options]
  fm-bench doctor [options]

Run options:
  -m, --models <list>       Models to benchmark, comma-separated or repeated
  -r, --runs <n>            Runs per prompt/model (default: 1)
      --warmup <n>          Warmup runs per model before measurement
  -c, --concurrency <n>     Parallel fm processes (default: 1)
      --sweep-concurrency <list>
                            Run separate operating points, e.g. 1,2,4
      --timeout-ms <n>      Timeout per fm call in ms (default: 60000)
      --slo-ttft-ms <n>     Count request as good only if TTFT is <= n
      --slo-e2e-ms <n>      Count request as good only if E2E latency is <= n
      --slo-tpot-ms <n>     Count request as good only if TPOT is <= n
  -p, --prompt <text>       Prompt to benchmark; repeatable
      --prompt-file <file>  .json, .jsonl, or blank-line separated text prompts
      --profile <name>      quick, standard, interactive, throughput, or stress
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

Output:
      --format <type>       table, json, or csv (default: table)
      --json                Alias for --format json
      --csv                 Alias for --format csv
      --ascii               Use plain ASCII tables instead of Unicode
      --compact             Force compact terminal layout
      --width <n>           Render for a specific terminal width
  -o, --out <file>          Save JSON or CSV report based on file extension
  -v, --verbose             Include per-run CSV after the summary table

Environment:
      --fm-bin <path>       fm binary to execute (default: FM_BIN or fm)
  -h, --help                Show this help
      --version             Print version

Examples:
  fm-bench
  fm-bench --models system,pcc --runs 3 --profile stress
  fm-bench --prompt "Reply with exactly: ok" --json --out bench.json
  fm-bench models
  fm-bench doctor
`;
}
