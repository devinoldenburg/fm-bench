# Changelog

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
