# Changelog

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
