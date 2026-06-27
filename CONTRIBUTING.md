# Contributing

Thanks for helping improve `fm-bench`.

## Setup

```sh
npm install
npm test
npm run lint
```

Use macOS 27 or newer when testing against the real Apple `fm` command. Unit tests do not require `fm`.

## Pull Requests

- Keep benchmark behavior deterministic where possible.
- Prefer runtime discovery from `fm --help` over hardcoded model lists.
- Include tests for parser, stats, schema, compare, and report changes.
- Do not commit benchmark reports that may contain private prompts or outputs.
- Report format changes must update `docs/report-format.md` and `CHANGELOG.md`.
