# Changelog

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
