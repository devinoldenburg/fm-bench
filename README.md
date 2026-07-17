# fm-bench

[![CI](https://github.com/devinoldenburg/fm-bench/actions/workflows/ci.yml/badge.svg)](https://github.com/devinoldenburg/fm-bench/actions/workflows/ci.yml)

Benchmark Apple's `fm` command on macOS 27+.

Measure latency, throughput, streaming smoothness, stability, and goodput across Apple Foundation Models — with repeatable prompt suites and JSON/CSV reports for automation.

## Why fm-bench exists

Apple's Foundation Models can run on-device, through Private Cloud Compute, and through model adapters. That makes raw model quality only half the story.

For real apps, the important questions are:

- How fast does the first token arrive?
- Does streaming stay smooth?
- How stable is latency over repeated runs?
- What happens under concurrency?
- Which model/hardware pair meets an interactive SLO?

`fm-bench` answers those questions with repeatable local benchmarks. Think of it as GeekBench for Apple Foundation Models — run it, get numbers, compare across hardware, models, and macOS updates.

## Quick Start

```sh
npm install -g fm-bench
fm-bench
```

One command discovers your models, runs the standard prompt suite, and prints a full benchmark report:

```text
fm-bench 0.6.3 | darwin/arm64 | fm
prompts 3 | runs 5 | concurrency 1 | stream on | measured 15 | failed 0 | skipped 0 | elapsed 38.20s

┌───┬────────┬────────┬─────────┬──────┬──────┬──────────┬──────┬──────────┬─────┬─────┐
│ C │ MODEL  │ STATUS │ OK/RUNS │ SUCC │ GOOD │ GOOD RPS │ TTFT │ E2E P95  │ SYS │ CV  │
├───┼────────┼────────┼─────────┼──────┼──────┼──────────┼──────┼──────────┼─────┼─────┤
│ 1 │ system │ ok     │   15/15 │ 100% │  93% │      0.4 │ 318ms│    3.20s │  42 │ 12% │
└───┴────────┴────────┴─────────┴──────┴──────┴──────────┴──────┴──────────┴─────┴─────┘
```

Default profile is `standard` (3 prompts). Use `--runs 5`, `--sweep-concurrency 1,2`, or `--profile client` for heavier suites.

Wide terminals add TTFT P95, TPOT, decode/prefill throughput, chunk-gap smoothness, and 95% CI columns. Narrow terminals switch to compact model cards automatically.

## Install

```sh
npm install -g fm-bench
```

Install directly from GitHub (always latest):

```sh
npm install -g --install-links git+https://github.com/devinoldenburg/fm-bench.git
```

Local development:

```sh
npm install && npm link
fm-bench doctor   # verify your setup
```

**Requirements:** macOS 27+, Node.js 20+, Apple Intelligence enabled.

## Commands

| Command | What it does |
|---------|-------------|
| `fm-bench` | Run the full benchmark (default) |
| `fm-bench models` | List discovered models, availability, and quota |
| `fm-bench compare <a.json> <b.json>` | Regression diff with suite/hardware warnings; `--strict` for CI |
| `fm-bench history [dir]` | Trend table from saved reports (sorted by time, tags visible) |
| `fm-bench validate <report.json>` | Verify report JSON (schema v1) before sharing |
| `fm-bench export <report.json>` | Standalone HTML report with embedded JSON |
| `fm-bench legend` | Definitions for every table column and color rule |
| `fm-bench doctor` | Environment check: Node, macOS, `fm`, CPU, memory, thermals, battery |

## Common Recipes

```sh
# Quick smoke test
fm-bench --profile quick

# Standard 5-run benchmark with SLO budgets
fm-bench --runs 5 --slo-ttft-ms 750 --slo-e2e-ms 4000

# Sweep concurrency to find your throughput ceiling
fm-bench --sweep-concurrency 1,2,4 --runs 3

# Stress both on-device and PCC models
fm-bench --models system,pcc --runs 3 --profile stress

# Reasoning and coding workloads
fm-bench --profile reasoning --runs 5
fm-bench --profile coding --runs 3 --histogram

# Archive runs and compare before/after a macOS update
fm-bench --output-dir reports/ --tag before-update --export-html
fm-bench --output-dir reports/ --tag after-update --export-html
fm-bench validate reports/*.json
fm-bench compare reports/fm-bench_*before*.json reports/fm-bench_*after*.json --strict

# Fail CI when SLOs regress
fm-bench --ci --slo-ttft-ms 750 --slo-e2e-ms 4000 --runs 5

# Save JSON for automation
fm-bench --json --out bench.json
fm-bench --format csv --out bench.csv
```

## Options Reference

**Workload**

| Flag | Default | Description |
|------|---------|-------------|
| `-m, --models <list>` | all | Comma-separated or repeated model names |
| `-r, --runs <n>` | 1 | Measured runs per prompt/model |
| `--warmup <n>` | 0 | Warmup runs per model before measurement |
| `-c, --concurrency <n>` | 1 | Parallel `fm` processes |
| `--sweep-concurrency <list>` | — | Separate operating points, e.g. `1,2,4` |
| `--request-rate <rps>` | — | Pace request starts at a target rate |
| `--ramp-up-ms <n>` | 0 | Gradually ramp pacing over `n` ms |
| `--timeout-ms <n>` | 60000 | Timeout per `fm` call |
| `--retry <n>` | 0 | Retry failed calls with exponential backoff (500ms–4s) |
| `--profile <name>` | standard | Built-in prompt suite (see Profiles) |
| `-p, --prompt <text>` | — | Custom prompt, repeatable |
| `--prompt-file <file>` | — | JSON, JSONL, or blank-line separated prompts |
| `-i, --instructions <text>` | — | Passed to `fm respond` |

**Quality Gates**

| Flag | Description |
|------|-------------|
| `--slo-ttft-ms <n>` | Count a run as good only if TTFT ≤ n ms |
| `--slo-e2e-ms <n>` | Count a run as good only if E2E latency ≤ n ms |
| `--slo-tpot-ms <n>` | Count a run as good only if TPOT ≤ n ms |
| `--ci` | Exit 1 if any run fails or any SLO is violated (for pipelines) |
| `--fail-fast` | Stop after the first failed run |

**Output**

| Flag | Description |
|------|-------------|
| `--json` / `--csv` | Output format (also `--format table\|json\|csv`) |
| `-o, --out <file>` | Save JSON (`.json`), per-run CSV (`.csv`), or shareable HTML (`.html`) |
| `--output-dir <dir>` | Auto-save timestamped JSON (and optional HTML with `--export-html`) |
| `--export-html` | With `--output-dir`, also write a matching `.html` report |
| `--tag <name>` | Label this run; repeatable; appears in payload and header |
| `--note <text>` | Freeform annotation in payload and header |
| `--histogram` | Print ASCII latency distribution chart after the report |
| `--capture-output` | Include raw model output in JSON reports |
| `-v, --verbose` | Append per-run CSV after the summary table |

**Display**

| Flag | Description |
|------|-------------|
| `--color` / `--no-color` | Force or disable ANSI colors (auto on TTYs) |
| `--ascii` | Plain ASCII table borders instead of Unicode |
| `--compact` | Force narrow terminal layout |
| `--width <n>` | Render as if the terminal is `n` columns wide |
| `--progress` / `--no-progress` | Force or disable the live progress line |

## Prompt Profiles

Nine built-in suites, choose the one that matches your use case:

| Profile | Prompts | Best for |
|---------|---------|----------|
| `quick` | 1 | Smoke test, fast health check |
| `standard` | 3 | Default — short chat, JSON generation, medium output |
| `interactive` | 3 | Conversational latency (TTFT-heavy) |
| `throughput` | 3 | Longer generation, token throughput signal |
| `client` | 5 | Real-world mix: chat, content, extraction, summarization, code |
| `stress` | 5 | High-load mix with math and reasoning |
| `reasoning` | 5 | Multi-step logic, estimation, debugging — capability + speed |
| `coding` | 5 | Code review, refactoring, algorithms, system design |
| `creative` | 5 | Product copy, analogies, commit messages, docs |

## Sharing and comparing results

Reports from 0.6.0+ include **schema v1**: `reportId`, hardware fingerprint, and a **suite key** so you can tell if two JSON files used the same prompts and run settings. See [docs/report-format.md](docs/report-format.md).

- Share **HTML** with teammates who do not use the CLI: `fm-bench export bench.json -o bench.html`
- Gate uploads in CI: `fm-bench validate artifact.json`
- Apples-to-apples regressions: same `--profile` and `--runs`, then `fm-bench compare a.json b.json`

## Regression Tracking

Track performance across macOS updates, model changes, or hardware swaps:

```sh
# Before
fm-bench --profile coding --runs 5 --output-dir reports/ --tag before

# After the change
fm-bench --profile coding --runs 5 --output-dir reports/ --tag after

# See what changed
fm-bench compare reports/fm-bench_*before*.json reports/fm-bench_*after*.json
```

The compare output shows each model/concurrency row with the before value, a color-coded percent delta (green = improvement, red = regression), and the after value — for TTFT, E2E, TPOT, tokens/s, RPS, success rate, and CV.

```sh
# View the full trend over time
fm-bench history reports/
```

## CI Integration

Gate deployments or model updates on benchmark quality:

```sh
# Fails with exit code 1 if TTFT > 750ms or E2E > 4s on any run
fm-bench --ci --slo-ttft-ms 750 --slo-e2e-ms 4000 --runs 5
```

Prints `fm-bench ci: PASS` or `fm-bench ci: FAIL — <reason>` to stderr. Designed for GitHub Actions, Buildkite, or any shell-based pipeline.

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

**Latency** — TTFT (p50/p95), E2E (p50/p95/p99), TPOT (p50/p95), 95% confidence interval, coefficient of variation (CV).

**Throughput** — prefill tokens/s, decode tokens/s, output tokens/s per request, aggregate system tokens/s, requests per second.

**Streaming quality** — second-chunk delay, chunk-gap p95. Captured from `stdout` chunks during streaming runs.

**Reliability** — success rate, goodput rate and RPS against SLO budgets, repeatability (most common output hash frequency across repeated runs).

**Stability** — CV (stddev/mean for E2E latency); green ≤10%, yellow ≤25%, red >25%.

Token counts come from `fm token-count --quiet`. If `fm` cannot count tokens, those fields are blank while character throughput is still reported.

Terminal layout is responsive: wide → full scoreboard + detail tables, medium → tighter single table, narrow → compact model cards. Use `--width` to preview any layout and `--ascii` for log-friendly output.

## Colors and Legend

Table output is color-coded on interactive terminals — **green** is better/passing, **yellow** is marginal/partial, **red** is failing/unstable. Fixed thresholds apply to success rate, goodput, CV, and repeatability. Latency uses SLO thresholds when set, otherwise lower-is-better relative ranking. Throughput uses higher-is-better relative ranking.

```sh
fm-bench legend          # full column definitions and color rules
fm-bench legend --json   # machine-readable
```

`NO_COLOR=1` disables color; `FORCE_COLOR=1` or `--color` enables it. `--ascii` switches to plain ASCII borders for log systems.

A live single-line progress indicator runs on stderr during interactive sessions. The final report always goes to stdout — `--json`, `--csv`, and `--out` stay automation-friendly.

## Requirements

- macOS 27.0 or newer (Apple's `fm` CLI is preinstalled there).
- Node.js 20 or newer.
- Apple Intelligence enabled on the device.

Benchmark commands refuse to start on older macOS versions and report the detected version plus the latest supported macOS — see [docs/supported-platforms.md](docs/supported-platforms.md).

`pcc` (Private Cloud Compute) availability depends on Apple's current eligibility. `fm-bench` shows it as skipped if `fm available --model pcc` reports unavailable.

See [docs/methodology.md](docs/methodology.md) for benchmark methodology and metric references.

## Development

```sh
npm install
npm test     # node --test
npm run lint
```

No runtime npm dependencies.

## License

MIT
