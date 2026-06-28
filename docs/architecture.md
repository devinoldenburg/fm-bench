# fm-bench architecture

Explicit overview for agents and contributors (not inferred from folder names alone).

## Decision

fm-bench is a **single-process Node.js CLI** (ESM, no runtime npm dependencies). Entry: `bin/fm-bench.js` → `src/cli.js` routes subcommands; benchmark work lives in `src/bench.js` with `src/fm.js` + `src/process.js` wrapping the external `fm` binary.

## Layers

| Layer | Paths | Responsibility |
|-------|--------|----------------|
| CLI | `src/cli.js`, `bin/fm-bench.js` | Args, doctor, compare, validate, export, history, legend, default benchmark |
| Benchmark | `src/bench.js`, `src/prompts.js`, `src/fm.js` | Model discovery, prompt suite, timed runs, streaming metrics |
| Reports | `src/report.js`, `src/schema.js`, `src/stats.js`, `src/export.js` | Schema v1 JSON, CSV flatten, HTML export, validation |
| Compare / history | `src/compare.js`, `src/history.js` | Regression diffs, trend tables |
| Presentation | `src/table.js`, `src/progress.js`, `src/ansi.js` | Terminal tables, progress, colors |

## External dependency

All inference goes through the **`fm` executable** (`FM_BIN` or `--fm-bin`). fm-bench does not embed models. Off macOS, use `scripts/mock-fm.sh` for pipeline tests.

## Tests

`node --test` under `test/` — parsers, schema, compare, CLI routing. No `fm` required for unit tests.

## CI

`.github/workflows/ci.yml` — `npm ci`, `npm test`, `npm run lint`, `publish:dry-run` on `macos-15`.