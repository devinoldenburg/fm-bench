# Report format (schema v1)

Every measured run can be saved as JSON. Reports from fm-bench **0.6.0+** include a versioned schema so you can validate, share, and compare results across machines.

## Top-level fields

| Field | Description |
|-------|-------------|
| `tool` | Always `"fm-bench"` |
| `version` | fm-bench package version that produced the report |
| `schemaVersion` | `"1"` for reports from 0.6.0+ (older reports omit this) |
| `reportId` | Random hex id for citing a single run |
| `startedAt` / `finishedAt` | ISO-8601 timestamps |
| `options` | Public run configuration (profile, runs, concurrency, SLOs, tags, note) |
| `environment` | Host fingerprint: platform, arch, Node, hardware model, CPU, memory, macOS version/build, `fm` help digest, thermal/power snapshot |
| `suite` | Derived suite key + fingerprint for apples-to-apples comparison |
| `prompts` | Prompt ids, text, and token counts |
| `models` | Discovered models and availability |
| `summary` | Per-model / per-concurrency roll-up statistics |
| `results` | Per-run measurements (optional `output` when `--capture-output`) |

## Sharing results

1. **JSON** — best for automation and `fm-bench compare`. Save with `--out bench.json` or `--output-dir reports/`.
2. **HTML** — self-contained page for humans: `--out bench.html`, `fm-bench export bench.json -o bench.html`, or `--output-dir reports/ --export-html`.
3. **CSV** — per-run rows only: `--format csv` or `--out runs.csv`.

Validate before publishing:

```sh
fm-bench validate my-report.json
```

## Comparable benchmarks

For fair comparison, match:

- Same `--profile` (or same `--prompt-file`)
- Same `--runs` and `--warmup`
- Same concurrency operating points (`--concurrency` or `--sweep-concurrency`)
- Same or intentionally changed macOS build (especially for beta-to-beta comparisons)
- Similar power/thermal state (see `environment.power` and `environment.thermal`)

```sh
fm-bench compare before.json after.json
fm-bench compare before.json after.json --strict   # exit 2 if suites differ
```

`compare` warns when hardware, macOS product version, macOS build, or suite configuration differ. Use `--tag` and `--note` so `fm-bench history` stays readable.

## Legacy reports

Reports from fm-bench before 0.6.0 remain valid JSON. They lack `schemaVersion`, `reportId`, `suite`, and enriched `environment`. `validate` still checks required fields; `compare` works on `summary` as before.
