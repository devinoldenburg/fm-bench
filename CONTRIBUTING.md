# Contributing

Thanks for helping improve `fm-bench`.

## Setup

```sh
npm install
npm test          # unit + integration tests (no real fm required)
npm run lint
npm run check     # lint + tests + npm pack integrity, before you push
```

Use macOS 27 or newer when testing against the real Apple `fm` command. The unit and integration tests do not require `fm`: they drive the CLI against `test/fixtures/fake-fm.mjs`, which emulates the real CLI surface and its failure modes.

## Pull Requests

- Keep benchmark behavior deterministic where possible.
- Prefer runtime discovery from `fm --help` over hardcoded subcommands, flags, or model names. Add new `fm` interactions behind the capability check in `src/capabilities.js`.
- Never invent a measurement. If `fm` cannot supply a metric, mark it unavailable in `src/metrics.js` and let it render as `-`.
- Keep measurement collection (`src/process.js`, `src/bench.js`) separate from post-processing and rendering so output work cannot affect timing.
- Include tests for parser, capability, stats, schema, compare, report, and CLI changes. Failure modes belong in `test/integration.test.js`.
- Do not commit benchmark reports that may contain private prompts or outputs.
- Report format changes must update `docs/report-format.md`, `docs/compatibility.md` when detection changes, and `CHANGELOG.md`.

## Real-machine checks

When you can, capture proof on real hardware:

```sh
node bin/fm-bench.js doctor
node bin/fm-bench.js models
node bin/fm-bench.js --profile quick --runs 3 --warmup 1
```

If a real `fm` build changes shape, add its captured help output as a fixture under `test/fixtures/` so the parsers stay covered, and update the verified-build table in `docs/compatibility.md`.
