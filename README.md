# fm-bench

`fm-bench` is a dynamic benchmark CLI for Apple's `fm` command on macOS 27 and newer.

It discovers the models reported by `fm --help`, checks availability with `fm available`, runs repeatable prompt suites through `fm respond`, counts tokens with `fm token-count`, and prints a terminal table with latency and throughput stats.

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
fm-bench 0.2.0 | darwin/arm64 | fm
prompts 3 | runs 1 | concurrency 1 | stream on | measured 3 | failed 0 | skipped models 0 | elapsed 11.36s

┌────────┬────────┬──────┬────┬─────────┬──────────┬──────────┬─────────┬─────────┬──────────┬───────┬─────┬──────┐
│ MODEL  │ STATUS │ RUNS │ OK │ SUCCESS │ TTFT P50 │ TTFT P95 │ E2E P50 │ E2E P95 │ TPOT P50 │ TOK/S │ RPS │ NOTE │
├────────┼────────┼──────┼────┼─────────┼──────────┼──────────┼─────────┼─────────┼──────────┼───────┼─────┼──────┤
│ system │ ok     │    3 │  3 │    100% │    409ms │    486ms │   2.29s │   5.97s │     14ms │  58.5 │ 0.3 │      │
└────────┴────────┴──────┴────┴─────────┴──────────┴──────────┴─────────┴─────────┴──────────┴───────┴─────┴──────┘

┌────────┬────────────┬─────────────┬─────────────┬──────────────┬─────────┬──────────┬────────┬──────────────────────────────────┐
│ MODEL  │ IN TOK AVG │ OUT TOK AVG │ TOTAL TOK/S │ DECODE TOK/S │ E2E P99 │ TPOT P95 │ REPEAT │ DESCRIPTION                      │
├────────┼────────────┼─────────────┼─────────────┼──────────────┼─────────┼──────────┼────────┼──────────────────────────────────┤
│ system │         35 │         196 │        59.5 │         75.0 │   6.30s │     15ms │      - │ On-device Apple Foundation Model │
└────────┴────────────┴─────────────┴─────────────┴──────────────┴─────────┴──────────┴────────┴──────────────────────────────────┘
```

## Commands

```sh
fm-bench [run] [options]
fm-bench models [options]
fm-bench doctor [options]
```

`run` is the default command. It benchmarks all models discovered from `fm` and skips models that are currently unavailable.

`models` lists discovered models, availability, descriptions, and quota output.

`doctor` checks Node, macOS, `fm`, and model availability.

## Benchmark Options

```sh
fm-bench --models system,pcc --runs 3 --profile stress
fm-bench --models system --runs 5 --profile interactive
fm-bench --models system --runs 3 --profile throughput --warmup 1
fm-bench --models system --profile interactive --sweep-concurrency 1,2,4
fm-bench --models system --runs 5 --slo-ttft-ms 750 --slo-e2e-ms 4000
fm-bench --prompt "Reply with exactly: ok" --runs 5
fm-bench --prompt-file prompts.json --format json --out reports/bench.json
fm-bench --format csv --out reports/bench.csv
```

Useful flags:

- `--models <list>`: comma-separated or repeated model names.
- `--runs <n>`: measured runs per prompt/model.
- `--warmup <n>`: warmup runs per model before measurement.
- `--concurrency <n>`: parallel `fm` processes.
- `--sweep-concurrency <list>`: run separate measured operating points, such as `1,2,4`.
- `--timeout-ms <n>`: timeout per `fm` call.
- `--slo-ttft-ms <n>`, `--slo-e2e-ms <n>`, `--slo-tpot-ms <n>`: count goodput against latency budgets.
- `--profile quick|standard|interactive|throughput|stress`: built-in prompt suite.
- `--prompt <text>`: custom prompt, repeatable.
- `--prompt-file <file>`: JSON, JSONL, or blank-line separated text prompts.
- `--instructions <text>`: passed to `fm respond`.
- `--available-only`: hide unavailable discovered models.
- `--capture-output`: include raw model output in JSON reports.
- `--json`, `--csv`, `--format table|json|csv`: choose output format.
- `--ascii`: use plain ASCII table borders.
- `--compact`: force the narrow terminal layout.
- `--width <n>`: render as if the terminal has `n` columns.
- `--out <file>`: save a report.

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
- output tokens per second per request.
- total output token throughput across the measured window.
- requests per second across the measured window.
- goodput percentage and goodput RPS when SLO flags are set.
- coefficient of variation (CV) and confidence interval context for stability.
- prompt and output token counts.
- p50, p95, and p99 tail latency views.
- repeatability across repeated runs of the same prompt.
- success and failure counts.
- unavailable model notes.

Token counts come from `fm token-count --quiet`. If `fm` cannot count a response, token fields are left blank while character throughput is still reported.

Measured runs stream by default so `fm-bench` can capture TTFT. Use `--no-stream` if you need buffered `fm respond` behavior; TTFT and TPOT fields that depend on streaming will be blank.

Terminal output is responsive. Wide terminals show full scoreboard and detail tables, medium terminals show a tighter operating-point table, and narrow terminals switch to compact model cards. Use `--width` to preview a layout and `--ascii` for log systems that do not render Unicode borders well.

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
