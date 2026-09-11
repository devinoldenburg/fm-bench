# Changelog

## 0.7.0

Correctness release: `fm-bench` now probes the installed `fm` for its real capabilities, measures what that build can actually supply, and reports everything else as explicitly unavailable.

### Benchmark correctness

- **Token counting was broken on current macOS 27 builds.** `fm` exposes `count-tokens`, but 0.6.3 called `token-count`, so prompt tokens, output tokens, TPOT, decode tokens/s, prefill tokens/s, per-request tokens/s, and aggregate token throughput were all blank. The subcommand is now detected (`count-tokens`, with legacy `token-count` as a fallback).
- **No fabricated precision.** `CV`, `stddev`, and the 95% confidence interval are unavailable with fewer than two successful samples instead of reporting `0` / a zero-width interval. `generation_ms` and `TPOT` are unavailable when the whole answer arrives in one stdout chunk, because prefill and decode are not separable, and the decode rate is withheld when an answer has fewer than three output tokens so a single chunk gap cannot masquerade as a token rate. Failed and timed-out runs no longer carry derived metrics.
- **Failed calls are represented honestly.** Each result records `attempts` (including retries) and the first actionable line of `fm` stderr, and retried successes stay a single sample.
- Report `results` and `summary` rows now carry only measured values; a metric the build cannot supply is `null`, and renders as `-`.

### `fm` compatibility

- New capability-detection boundary (`src/capabilities.js`): probes `fm --help` and `fm respond --help` once per run and derives the command list, models, and feature flags, tolerating `--[no-]flag` spellings and ANSI output.
- `models` no longer runs the non-existent `quota-usage` subcommand, so `Error: Unknown command 'quota-usage'` can no longer appear in tables or reports. Quota is reported as unavailable when the build has no quota command.
- Models the build does not expose are rejected before a benchmark starts (`not supported by this fm build (supported: system)`), and raw `fm` argument-error/usage text never reaches user-facing output.
- A benchmark with no usable model now fails fast with exit code `2` and an actionable message instead of printing an empty report.
- Flags the build does not document (`--stream`, `--use-case`, `--guardrails`, `--instructions`, `--greedy`, `--model`) are no longer passed through blindly.
- New [docs/compatibility.md](docs/compatibility.md) documents the detection and capability policy plus the verified build.

### Report schema (still v1)

- Reports gain a `capabilities` block (commands, models, feature flags, help digest, warnings) and a `metrics` block describing each metric's provenance — `measured`, `proxy`, `derived`, or `controlled` — and availability with a reason. Both are additive; 0.6.x reports remain valid and readable.
- CSV per-run rows gain an `attempts` column.

### CLI and output

- Exit codes are now consistent: `1` for operational failures (`--ci` gate, invalid reports, `fm` errors), `2` for usage and environment errors (unknown flags, missing arguments, unsupported macOS, unusable `fm`, no runnable model). Previously usage errors exited `1`.
- `fm-bench models` prints a capability summary (`fm`, commands, features, warnings) above the table, and omits the quota column when the build has no quota command.
- `fm-bench doctor` reports the `fm` help digest, command list, token counting, streaming, and quota support, and supports `--json`. `validate --json` prints `{ ok, files }` for CI.
- `fm-bench legend` now shows metric provenance in a SOURCE column, and table output names unavailable metrics instead of leaving blank columns.
- Ctrl+C and SIGTERM terminate in-flight `fm` child processes before exiting (`130` / `143`).
- Report headers and `--tag`/`--note` lines wrap instead of being truncated with an ellipsis.
- Machine formats stay clean: `--json` / `--csv` write only data to stdout, including with `--progress`.

### Robustness and security

- Malformed `fm` output (invalid UTF-8, control bytes) no longer risks crashing a run.
- Table, compare, and history output strips ANSI escapes and control characters from report and `fm` text before printing.
- CSV cells that begin with `=`, `+`, `@`, or a non-numeric `-` are prefixed with a single quote so spreadsheets do not execute prompts or model output as formulas.
- Prompt-file parse errors name the file (and JSONL line) instead of surfacing a bare JSON error.

### Tests, CI, and packaging

- Test suite grew from 58 to 149 tests: statistics edge cases (n=0, n=1, n=2, unsorted input, known CI values), capability parsing against the captured macOS 27 help output, `fm` compatibility parsing, report normalization and CSV escaping, HTML escaping, comparison handling, and a fake-`fm` integration suite covering normal, streaming, slow, malformed, failing, timed-out, unavailable-model, quota, partial-stream, and interrupted-process behaviour.
- `npm run check` runs lint, the full suite, and package-content verification; `prepack` is wired to it.
- CI runs on Node 20 and 24, runs `npm run check`, and adds CLI smoke tests.
- The Release workflow no longer fails the whole release when `NPM_TOKEN` is absent: it warns, skips npm publish, and still creates the GitHub release.

### Verified

- macOS 27.0 build `26A5425a`, Apple M5 Pro (Mac17,9), Node v24.16.0, with the installed `/usr/bin/fm` (`available`, `chat`, `count-tokens`, `license`, `respond`, `schema`, `serve`; model `system`): `doctor`, `models`, real benchmark runs, `validate`, `export`, `compare`, `history`, and `legend` all pass, with token counts, TPOT, decode and prefill throughput measured from the real binary.

## 0.6.3

- **macOS version gate**: `run` and `models` refuse to start on macOS older than 27.0 (or on non-macOS hosts), exiting with code 2 and naming both the detected version and the latest supported macOS (`27.0+`).
- **Doctor diagnostics**: `fm-bench doctor` still runs on unsupported hosts so it can report the macOS mismatch, the latest supported version, and a failed `fm` probe instead of hard-exiting first.
- **Supported platforms doc**: new [docs/supported-platforms.md](docs/supported-platforms.md) describing the fixed macOS requirement and which commands are gated.
- **Package metadata**: `package.json` now declares `"os": ["darwin"]` so npm marks the package as macOS-only.
- **Pack integrity**: `npm run check:pack` (wired into `prepack`) walks runtime imports and fails if any required file is missing from the published tarball.
- **Verified** on macOS 27.0 build `26A5378n` (Apple M5 Pro) with the installed `fm` CLI: doctor, quick/standard benchmarks, validate/export/history, and CI-style SLO runs all passed.

## 0.6.2

- **macOS 27 beta 3 compatibility**: verified on macOS 27.0 beta 3 build `26A5378j` with the installed `fm` CLI and Xcode 26.6 toolchain.
- **Compare accuracy**: `fm-bench compare` now warns when two reports were captured on different macOS build versions, even when both report the same product version such as `27.0`.
- **Compare metadata**: compare headers now show the macOS product version and build, making beta-to-beta Foundation Models benchmark changes easier to audit.

## 0.6.1

- **Release** workflow: GitHub release bodies are generated from `CHANGELOG.md` (not empty auto-notes). Re-running Release on an existing tag updates release notes.

## 0.6.0

- **Report schema v1**: JSON reports include `schemaVersion`, `reportId`, and a `suite` block (profile, prompt count, environment fingerprint) for shareable, comparable benchmarks.
- **Richer `environment` in every run**: hardware model, CPU, memory, thermal/power snapshot, and a short `fm --help` digest (matches what `doctor` already probes).
- **`validate` command**: verify one or more report JSON files before sharing or CI ingestion.
- **`export` command** and **`--export-html`**: standalone HTML reports with embedded JSON for humans and automation.
- **`compare` improvements**: compatibility warnings for mismatched suites, hardware, or macOS; `--strict` exits 2 when suites differ; metadata shows tags and hardware.
- **`history` improvements**: sort by `startedAt`, show tag/note/profile column.
- **`--output-dir`**: optional tag suffix in filenames; pair JSON + HTML with `--export-html`.
- **`--out`**: `.html` extension writes a shareable HTML report.
- Documentation: [docs/report-format.md](docs/report-format.md), updated README and methodology cross-links.
- Tests for schema, compare compatibility, and HTML export.

## 0.5.3

- Hardened **Release** workflow: skip npm publish when the version is already on the registry (safe to re-run after partial failures), verify `package.json` version matches the git tag, and skip duplicate GitHub releases.
- **CI** now runs `npm run publish:dry-run`, uses concurrency groups to cancel superseded runs, and documents release steps in `docs/releasing.md`.
- **Version** workflow pushes explicitly to `main` with concurrency protection.
- Added Dependabot for GitHub Actions and a CI status badge on the README.
- Normalized `package.json` `bin` path for npm publish (`npm pkg fix`).

## 0.5.2

- Fixed `doctor` thermal and battery checks on macOS 27, where `pmset -g therm` no longer emits `CPU_Scheduler_Limit` and `pmset -g batt` reports AC power on a separate line. Thermal state is now parsed via dedicated helpers that recognise both the legacy numeric form and the macOS 27 informational `Note:` lines, and the healthy idle state is reported explicitly as "no thermal pressure" instead of being silently dropped.
- Battery parsing now understands both the macOS 27 `AC attached; not charging` form and the legacy `AC Power` / `discharging` wording.
- Added `src/system.js` with `parseThermalOutput` and `parseBatteryOutput`, plus unit tests covering legacy and macOS 27 outputs.

## 0.5.1

- Repositioned README as the GeekBench for Apple Foundation Models.
- New title, tagline, and Why section lead the page.
- Quick Start moved before Install so readers see output immediately.
- Commands replaced with a scannable table.
- Benchmark Options replaced with Common Recipes (copy-paste examples) and four clean option tables (Workload, Quality Gates, Output, Display).
- Table Legend, Live Progress, and Terminal Colors merged into a single Colors and Legend section.

## 0.5.0

- Added `compare` command: diff two saved JSON reports side-by-side with absolute and percent change for every latency, throughput, and reliability metric. Lower-is-better coloring for latency and CV; higher-is-better for throughput.
- Added `history` command: scan a directory for fm-bench JSON reports and display a chronological trend table. Pairs with `--output-dir` to build a persistent benchmark archive.
- Added three new prompt profiles:
  - `reasoning`: five prompts covering multi-step math, logic sequences, causal chains, Fermi estimation, and code debugging.
  - `coding`: five prompts covering code review, refactoring, algorithms, code explanation, and system design.
  - `creative`: five prompts covering product announcements, error message rewrites, technical analogies, commit messages, and doc summaries.
- Added `--retry <n>`: automatically retry failed `fm respond` calls up to `n` times with exponential backoff (500ms, 1s, 2s, up to 4s cap).
- Added `--ci`: disables color and progress output, then exits with code 1 if any measured run fails or any SLO budget is violated. Prints a `PASS`/`FAIL` summary line to stderr. Designed for GitHub Actions and other CI pipelines.
- Added `--tag <name>` (repeatable) and `--note <text>`: metadata attached to the JSON payload and printed in the table report header for self-describing reports.
- Added `--output-dir <dir>`: automatically save a timestamped JSON report (`fm-bench_<timestamp>_<model>.json`) to the given directory on every run.
- Added `--histogram`: print an ASCII latency distribution bar chart (up to 20 buckets, auto-sized to terminal width) after the main report.
- Enhanced `doctor` command: now also reports hardware model (`hw.model`), CPU brand string, total memory in GB, thermal throttle limit via `pmset -g therm` (warns when below 100%), and battery percentage and charging state via `pmset -g batt`.

## 0.4.4

- Wrapped long benchmark `NOTE`, `DESCRIPTION`, model description, and quota cells instead of truncating them with ellipses.
- Kept metric columns compact while showing full unavailable-model and quota context.

## 0.4.3

- Wrapped long `fm-bench legend` table cells instead of truncating them with ellipses.
- Kept legend output within the requested terminal width while showing full definitions and rules.

## 0.4.2

- Added `fm-bench legend` for standalone definitions of every terminal table column, compact field, model-list column, and color rule.
- Added JSON and CSV output for the legend command via `--json` and `--csv`.
- Removed the metric legend footer from benchmark reports so benchmark output stays focused on results.

## 0.4.1

- Clarified the terminal legend for CV coloring: green `<=10%`, yellow `<=25%`, red `>25%`.
- Documented that red CV means high latency variation, even though lower CV is steadier.

## 0.4.0

- Added a live progress status line on stderr so benchmark runs no longer look stalled while models are discovered, tokens are counted, warmups run, and measured jobs complete.
- Added `--progress` and `--no-progress` controls.
- Added request pacing with `--request-rate <rps>` and `--ramp-up-ms <n>` so arrival rate can be controlled separately from concurrency.
- Added prefill tokens/sec, second-chunk delay, chunk-gap statistics, total token throughput, and explicit zero goodput RPS when SLOs are missed.
- Added a `client` prompt profile for a broader local-machine workload covering short chat, content generation, structured extraction, summarization, and code analysis.
- Updated terminal tables, CSV exports, JSON payloads, README, and methodology docs for the new metrics.

## 0.3.1

- Added semantic ANSI colors for terminal tables and compact reports.
- Added `--color` and `--no-color` controls, with `NO_COLOR` and `FORCE_COLOR` support.
- Colored latency metrics by SLO budgets when provided, and by lower-is-better relative ranking otherwise.
- Colored throughput, success, goodput, stability, repeatability, model availability, and skipped-model statuses.
- Preserved responsive table widths when color escapes are enabled.

## 0.3.0

- Added `--sweep-concurrency` for separate measured operating points.
- Added SLO-based goodput with `--slo-ttft-ms`, `--slo-e2e-ms`, and `--slo-tpot-ms`.
- Added standard deviation, coefficient of variation, and 95% confidence interval fields to numeric summaries.
- Reworked terminal rendering into wide, medium, and compact layouts selected by terminal width.
- Added `--compact` and `--width` terminal output controls.
- Added responsive report tests.

## 0.2.0

- Added streaming TTFT measurement.
- Added TPOT, generation time, decode throughput, request throughput, p99 latency, and repeatability.
- Reworked terminal output into a prettier benchmark report with Unicode tables and ASCII fallback.
- Added interactive and throughput prompt profiles.
- Added methodology documentation with benchmark metric references.

## 0.1.0

- Initial release.
- Dynamic `fm` model discovery.
- Availability and quota inspection.
- Latency and throughput benchmark tables.
- JSON and CSV report output.
