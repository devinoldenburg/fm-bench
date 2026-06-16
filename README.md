# fm-bench

`fm-bench` is a dynamic benchmark CLI for Apple's `fm` command on macOS 27 and newer.

It discovers the models reported by `fm --help`, checks availability with `fm available`, runs repeatable prompt suites through `fm respond`, counts tokens with `fm token-count`, shows live progress while it works, and prints terminal tables with latency, throughput, stability, goodput, and streaming-quality stats.

Apple introduced the preinstalled `fm` command for macOS 27 as part of the Foundation Models tooling. `fm-bench` intentionally shells out to the system `fm` binary instead of linking private APIs, so it can adapt as Apple adds models or changes availability.

## Install

```sh
npm install -g fm-bench
```

You can also install directly from GitHub:

```sh
npm install -g --install-links git+https://github.com/devinoldenburg/fm-bench.git
```

For local development from this repository:

```sh
npm install
npm link
fm-bench doctor
```

## Quick Start

```sh
fm-bench
```

Example output:

```text
fm-bench 0.4.0 | darwin/arm64 | fm
prompts 5 | runs 3 | concurrency 1,2 | stream on | measured 30 | failed 0 | skipped 0 | elapsed 42.10s | SLO TTFT<=750ms,E2E<=4.00s

┌───┬────────┬────────┬─────────┬──────┬──────┬──────────┬──────┬──────────┬─────┬─────┐
│ C │ MODEL  │ STATUS │ OK/RUNS │ SUCC │ GOOD │ GOOD RPS │ TTFT │ E2E P95  │ SYS │ CV  │
├───┼────────┼────────┼─────────┼──────┼──────┼──────────┼──────┼──────────┼─────┼─────┤
│ 1 │ system │ ok     │   15/15 │ 100% │  93% │      0.4 │ 318ms│    3.20s │  42 │ 12% │
│ 2 │ system │ ok     │   15/15 │ 100% │  80% │      0.7 │ 501ms│    4.40s │  68 │ 21% │
└───┴────────┴────────┴─────────┴──────┴──────┴──────────┴──────┴──────────┴─────┴─────┘
```

## Commands

```sh
fm-bench [run] [options]
fm-bench models [options]
fm-bench compare <before.json> <after.json> [options]
fm-bench history [dir] [options]
fm-bench legend [options]
fm-bench doctor [options]
```

`run` is the default command. It benchmarks all models discovered from `fm` and skips models that are currently unavailable.

`models` lists discovered models, availability, descriptions, and quota output.

`compare` reads two saved JSON reports and prints a side-by-side regression table showing absolute and percent change for every latency, throughput, and reliability metric. Green/yellow/red coloring applies lower-is-better logic for latency and CV and higher-is-better for throughput. Use `--json` to get the diff as structured data.

`history` scans a directory for fm-bench JSON report files and prints a chronological trend table. Pairs with `--output-dir` to build a persistent benchmark archive.

`legend` explains every terminal table column, compact-card field, model-list column, and color rule. It does not run `fm`.

`doctor` checks Node, macOS, `fm`, model availability, CPU, memory, thermal throttle state, and battery status.

## Benchmark Options

```sh
fm-bench --models system,pcc --runs 3 --profile stress
fm-bench --models system --runs 5 --profile interactive
fm-bench --models system --runs 3 --profile throughput --warmup 1
fm-bench --models system --profile interactive --sweep-concurrency 1,2,4
fm-bench --profile client --sweep-concurrency 1,2 --request-rate 0.5 --ramp-up-ms 2000
fm-bench --models system --runs 5 --slo-ttft-ms 750 --slo-e2e-ms 4000
fm-bench --profile reasoning --runs 5 --retry 2
fm-bench --profile coding --runs 3 --tag pre-update --output-dir reports/
fm-bench --prompt "Reply with exactly: ok" --runs 5
fm-bench --prompt-file prompts.json --format json --out reports/bench.json
fm-bench --format csv --out reports/bench.csv
fm-bench --histogram
fm-bench --ci --slo-ttft-ms 750 --slo-e2e-ms 4000
fm-bench compare reports/before.json reports/after.json
fm-bench history reports/
fm-bench legend
fm-bench legend --json
```

Useful flags:

- `--models <list>`: comma-separated or repeated model names.
- `--runs <n>`: measured runs per prompt/model.
- `--warmup <n>`: warmup runs per model before measurement.
- `--concurrency <n>`: parallel `fm` processes.
- `--sweep-concurrency <list>`: run separate measured operating points, such as `1,2,4`.
- `--request-rate <rps>`: pace request starts at a target requests-per-second rate.
- `--ramp-up-ms <n>`: gradually ramp request pacing over `n` milliseconds.
- `--timeout-ms <n>`: timeout per `fm` call.
- `--retry <n>`: retry failed `fm` calls up to `n` times with exponential backoff (500ms–4s). Useful for handling transient model busy errors.
- `--slo-ttft-ms <n>`, `--slo-e2e-ms <n>`, `--slo-tpot-ms <n>`: count goodput against latency budgets.
- `--ci`: exit with code 1 if any run fails or any SLO budget is violated. Disables color and progress. Designed for GitHub Actions and CI pipelines.
- `--profile quick|standard|interactive|throughput|client|stress|reasoning|coding|creative`: built-in prompt suite.
- `--prompt <text>`: custom prompt, repeatable.
- `--prompt-file <file>`: JSON, JSONL, or blank-line separated text prompts.
- `--instructions <text>`: passed to `fm respond`.
- `--tag <name>`: tag this run (repeatable). Tags appear in the JSON payload and report header.
- `--note <text>`: freeform note attached to the JSON payload and report header.
- `--available-only`: hide unavailable discovered models.
- `--capture-output`: include raw model output in JSON reports.
- `--json`, `--csv`, `--format table|json|csv`: choose output format.
- `--ascii`: use plain ASCII table borders.
- `--color`, `--no-color`: force or disable semantic ANSI colors. Colors are automatic on TTYs.
- `--progress`, `--no-progress`: force or disable the live progress status line on stderr.
- `--compact`: force the narrow terminal layout.
- `--width <n>`: render as if the terminal has `n` columns.
- `--histogram`: print an ASCII latency distribution bar chart after the report.
- `--out <file>`: save a report.
- `--output-dir <dir>`: auto-save a timestamped JSON report to a directory on every run.

## Prompt Profiles

Nine built-in profiles cover a range of workloads:

| Profile | Prompts | Focus |
|---------|---------|-------|
| `quick` | 1 | Single-prompt smoke test |
| `standard` | 3 | Short chat, structured JSON, medium generation |
| `interactive` | 3 | Short conversational turns |
| `throughput` | 3 | Longer generation and transformation tasks |
| `client` | 5 | Broad real-world mix: chat, content, extraction, summarization, code review |
| `stress` | 5 | Diverse stress mix with math and reasoning |
| `reasoning` | 5 | Multi-step math, logic, causal chains, estimation, debugging |
| `coding` | 5 | Code review, refactoring, algorithms, code explanation, system design |
| `creative` | 5 | Product copy, error messages, analogies, commit messages, doc writing |

Use `--profile reasoning` or `--profile coding` for richer signal when evaluating a model's capability alongside raw speed.

## Compare Reports

Save two runs to JSON and diff them:

```sh
fm-bench --runs 5 --json --out before.json
# ... update your system, wait, or run again ...
fm-bench --runs 5 --json --out after.json
fm-bench compare before.json after.json
```

Output shows each model/concurrency row with before value, delta percentage (color-coded green/yellow/red), and after value for TTFT, E2E, TPOT, tokens/s, RPS, success rate, and CV.

## Benchmark History

Use `--output-dir` to build an archive, then view trends with `history`:

```sh
fm-bench --output-dir reports/ --runs 3
fm-bench --output-dir reports/ --runs 3
fm-bench history reports/
```

## CI Integration

Use `--ci` to fail the pipeline when quality regresses:

```sh
fm-bench --ci --slo-ttft-ms 750 --slo-e2e-ms 4000 --runs 5
```

Exit code is 0 on pass, 1 on any failure or SLO violation. Prints `fm-bench ci: PASS` or `fm-bench ci: FAIL — <reasons>` to stderr.

## Prompt Files

JSON array:

```json
[
  { "id": "tiny", "prompt": "Reply with exactly: ok" },
  { "id": "json", "prompt": "Convert alpha, beta, gamma into JSON." }
]
```

JSONL:

```jsonl
{"id":"tiny","prompt":"Reply with exactly: ok"}
{"id":"latency","prompt":"Explain p95 latency in one sentence."}
```

Plain text files are split on blank lines.

## Metrics

`fm-bench` reports:

- TTFT, or time to first streamed output.
- E2E latency, or full response wall-clock latency.
- TPOT, or decode time per output token after the first output token.
- second-chunk delay and chunk-gap p95 as terminal-side streaming smoothness signals.
- prefill tokens per second, or prompt tokens divided by TTFT.
- output tokens per second per request.
- total output token throughput across the measured window.
- total token throughput, including prompt and output tokens.
- requests per second across the measured window.
- goodput percentage and goodput RPS when SLO flags are set.
- coefficient of variation (CV) and confidence interval context for stability.
- prompt and output token counts.
- p50, p95, and p99 tail latency views.
- repeatability across repeated runs of the same prompt.
- success and failure counts.
- unavailable model notes.

Token counts come from `fm token-count --quiet`. If `fm` cannot count a response, token fields are left blank while character throughput is still reported.

Measured runs stream by default so `fm-bench` can capture TTFT and streaming smoothness. Use `--no-stream` if you need buffered `fm respond` behavior; TTFT, TPOT, second-chunk, and chunk-gap fields that depend on streaming will be blank.

Terminal output is responsive. Wide terminals show full scoreboard and detail tables, medium terminals show a tighter operating-point table, and narrow terminals switch to compact model cards. Long `NOTE`, `DESCRIPTION`, and model quota cells wrap so error context stays visible instead of being hidden behind ellipses. Use `--width` to preview a layout and `--ascii` for log systems that do not render Unicode borders well.

## Table Legend

Benchmark output stays focused on results and does not print the metric legend footer. Use `fm-bench legend` when you want definitions for every table column and color rule:

```sh
fm-bench legend
fm-bench legend --json
fm-bench legend --csv
```

The legend wraps long definitions and rules to fit the terminal width instead of hiding text behind ellipses.

## Live Progress

Interactive terminal runs show a single-line status indicator on stderr while prompts are loaded, models are inspected, tokens are counted, warmups run, and benchmark jobs complete. The final report still prints to stdout, so `--json`, `--csv`, and `--out` remain automation-friendly.

Progress is automatic for table output on TTYs. Use `--progress` to force it or `--no-progress` to keep the terminal completely quiet until the report is ready.

## Terminal Colors

Table output uses semantic ANSI color on interactive terminals:

- green: passing, steadier, or better than the current comparison set.
- yellow: marginal, partial, or near a budget.
- red: failing a budget, unstable, or slower/lower than peers.

Success rate, goodput, repeatability, and CV use fixed benchmark thresholds. CV is green at `<=10%`, yellow at `<=25%`, and red above `25%` because higher CV means less steady latency. Throughput columns use relative ranking within the current run because “good” depends on the machine, model, prompt mix, and concurrency. TTFT, E2E, and TPOT use SLO thresholds when you pass `--slo-ttft-ms`, `--slo-e2e-ms`, or `--slo-tpot-ms`; otherwise they use lower-is-better relative ranking across the models and operating points in the report.

Use `--color` to force ANSI colors in captured logs, or `--no-color` for plain output. `NO_COLOR=1` disables automatic color and `FORCE_COLOR=1` enables it.

See [docs/methodology.md](docs/methodology.md) for the benchmark methodology and source references.

## Requirements

- macOS 27 or newer for Apple's `fm` CLI.
- Node.js 20 or newer.
- Apple Intelligence and model availability configured for the machine.

Private Cloud Compute (`pcc`) availability depends on Apple's current eligibility and context. If `fm available --model pcc` reports unavailable, `fm-bench` will show it as skipped.

## Development

```sh
npm install
npm test
npm run lint
npm pack
```

The package has no runtime npm dependencies.

## Releases

Releases are tag-driven:

```sh
npm run release:patch
npm run release:minor
npm run release:major
```

Pushing a `v*.*.*` tag runs the GitHub Release workflow, publishes to npm using the repository `NPM_TOKEN` secret, and creates a GitHub Release with generated notes.

Maintainers can also run the **Version** workflow manually from GitHub Actions to bump the version and push the tag.

## License

MIT
