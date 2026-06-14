# fm-bench

`fm-bench` is a dynamic benchmark CLI for Apple's `fm` command on macOS 27 and newer.

It discovers the models reported by `fm --help`, checks availability with `fm available`, runs repeatable prompt suites through `fm respond`, counts tokens with `fm token-count`, and prints a terminal table with latency and throughput stats.

Apple introduced the preinstalled `fm` command for macOS 27 as part of the Foundation Models tooling. `fm-bench` intentionally shells out to the system `fm` binary instead of linking private APIs, so it can adapt as Apple adds models or changes availability.

## Install

```sh
npm install -g --install-links git+https://github.com/devinoldenburg/fm-bench.git
```

After the package is published to the npm registry, this will also work:

```sh
npm install -g fm-bench
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
+--------+---------+------+----+------+-------+-------+-------+-------+--------+---------+------+
| model  | status  | runs | ok | fail | p50   | p95   | avg   | tok/s | char/s | out tok | note |
+--------+---------+------+----+------+-------+-------+-------+-------+--------+---------+------+
| system | ok      |    3 |  3 |    - | 1.21s | 1.85s | 1.34s |  18.7 |    83  |      24 |      |
| pcc    | skipped |    - |  - |    - | -     | -     | -     | -     | -      | -       | PCC inference is not available... |
+--------+---------+------+----+------+-------+-------+-------+-------+--------+---------+------+
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
fm-bench --prompt "Reply with exactly: ok" --runs 5
fm-bench --prompt-file prompts.json --format json --out reports/bench.json
fm-bench --format csv --out reports/bench.csv
```

Useful flags:

- `--models <list>`: comma-separated or repeated model names.
- `--runs <n>`: measured runs per prompt/model.
- `--warmup <n>`: warmup runs per model before measurement.
- `--concurrency <n>`: parallel `fm` processes.
- `--timeout-ms <n>`: timeout per `fm` call.
- `--profile quick|standard|stress`: built-in prompt suite.
- `--prompt <text>`: custom prompt, repeatable.
- `--prompt-file <file>`: JSON, JSONL, or blank-line separated text prompts.
- `--instructions <text>`: passed to `fm respond`.
- `--available-only`: hide unavailable discovered models.
- `--capture-output`: include raw model output in JSON reports.
- `--json`, `--csv`, `--format table|json|csv`: choose output format.
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

- `p50`, `p95`, and average wall-clock latency.
- average output tokens per second.
- average characters per second.
- average output tokens.
- success and failure counts.
- unavailable model notes.

Token counts come from `fm token-count --quiet`. If `fm` cannot count a response, the token fields are left blank while character throughput is still reported.

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

## License

MIT
