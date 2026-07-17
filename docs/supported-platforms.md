# Supported platforms

`fm-bench` benchmarks Apple's `fm` command, so support follows the platforms where Apple ships that CLI.

## Requirements

- **macOS 27.0 or newer** — Apple's `fm` CLI is preinstalled starting with macOS 27. Older macOS releases do not ship `fm`, so `fm-bench` cannot run there.
- **Node.js 20 or newer**.
- **Apple Intelligence enabled** on the device.

`pcc` (Private Cloud Compute) availability additionally depends on Apple's current eligibility. `fm-bench` reports it as skipped when `fm available --model pcc` reports unavailable.

## Version enforcement

Every command that launches `fm` — the default `run` benchmark, `models`, and `doctor` — checks the macOS version first and refuses to start on anything older than macOS 27:

```text
fm-bench: unsupported macOS: detected macOS 26.1, but fm-bench requires macOS 27 or newer (Apple's fm CLI is preinstalled there).
Latest supported: macOS 27.0 or newer (fm is not available on older macOS releases).
```

The process exits with code `2`. This is deliberate: running on an unsupported macOS could never produce a valid benchmark, so the CLI fails fast with the exact version it found and the latest supported macOS version.

Commands that only read local report files — `compare`, `history`, `validate`, `export`, and `legend` — are not gated and work anywhere Node.js runs.

`fm-bench doctor` prints the detected macOS version and, on unsupported systems, an explicit `macOS support` line plus the latest supported version.
