# Contributing

Thanks for helping improve `fm-bench`.

## Setup

```sh
npm install
npm test
npm run lint
```

Use macOS 27 or newer when testing against the real Apple `fm` command. Unit tests do not require `fm`.

On Linux or CI-like environments, run a quick benchmark with the mock `fm` stub:

```sh
chmod +x scripts/mock-fm.sh
FM_BIN="$(pwd)/scripts/mock-fm.sh" node bin/fm-bench.js --models system --runs 2 --profile quick
```

See `docs/architecture.md` for how CLI, benchmark, and report layers fit together.

## Pull Requests

- Keep benchmark behavior deterministic where possible.
- Prefer runtime discovery from `fm --help` over hardcoded model lists.
- Include tests for parser, stats, schema, compare, and report changes.
- Do not commit benchmark reports that may contain private prompts or outputs.
- Report format changes must update `docs/report-format.md` and `CHANGELOG.md`.
