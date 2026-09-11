# Supported platforms

`fm-bench` benchmarks Apple's `fm` command, so support follows the platforms where Apple ships that CLI.

## Requirements

- **macOS 27.0 or newer** — Apple's `fm` CLI is preinstalled starting with macOS 27. Older macOS releases do not ship `fm`, so `fm-bench` cannot run there.
- **Node.js 20 or newer**.
- **Apple Intelligence enabled** on the device.

## Version enforcement

Commands that launch `fm` benchmarks — the default `run` command and `models` — check the macOS version first and refuse to start on anything older than macOS 27:

```text
fm-bench: unsupported macOS: detected macOS 26.1, but fm-bench requires macOS 27 or newer (Apple's fm CLI is preinstalled there).
Latest supported: macOS 27.0 or newer (fm is not available on older macOS releases).
```

The process exits with code `2`. This is deliberate: running on an unsupported macOS could never produce a valid benchmark, so the CLI fails fast with the exact version it found and the latest supported macOS version.

The gate guards the **default** `fm` discovery path, because Apple only ships the CLI from macOS 27. If you explicitly provide a binary with `--fm-bin <path>` or `FM_BIN`, the host version is not a constraint and fm-bench proceeds on any platform — the capability probe still exits `2` if that binary is unusable.

Commands that only read local report files — `compare`, `history`, `validate`, `export`, and `legend` — are not gated and work anywhere Node.js runs.

`fm-bench doctor` still runs on unsupported hosts so you can diagnose the environment: it prints the detected macOS version, an explicit `macOS support` line, and the latest supported version.

## Which `fm` builds work

Support is capability-based rather than version-pinned. The CLI probes the installed `fm` and reports what it can measure; a build that exposes different subcommand names or fewer flags still works, with the unsupported metrics reported as unavailable. See [compatibility.md](./compatibility.md) for the detection policy and the verified build table.

## Models

`fm-bench` benchmarks exactly the models the installed `fm` reports — it does not assume that any particular cloud or adapter model exists. On the verified macOS 27.0 build that is the on-device `system` model only. If a build adds models (for example a Private Cloud Compute model), they are discovered automatically and reported with their own availability.

Requesting only models the build cannot run exits with code `2` before any benchmark starts, and `fm-bench models` shows the same reasons without failing:

```text
fm-bench: No benchmark was run: none of the requested models are usable right now.
  requested: pcc
  pcc: not supported by this fm build (supported: system)
  run "fm-bench models" to see availability and reasons
```
