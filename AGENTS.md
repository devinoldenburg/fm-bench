# AGENTS.md

## Cursor Cloud specific instructions

`fm-bench` is a single Node.js CLI (ESM, `bin/fm-bench.js` → `src/`). It has **no runtime npm dependencies**, so `npm install` is effectively a no-op beyond Node itself. Node 20+ is required (the VM has Node 22). Standard commands are documented in `README.md` ("Development") and `package.json` `scripts`:

- Test: `npm test` (`node --test`)
- Lint: `npm run lint` (`node --check` on every `.js`)
- Run: `node bin/fm-bench.js <command>` (run directly; `npm link` fails on this VM due to a read-only global prefix — use the direct path instead)

### Running the benchmark off macOS (key gotcha)

The product benchmarks Apple's `fm` CLI, which only exists on macOS 27+ with Apple Intelligence. On the Linux cloud VM `fm` is absent, so `doctor`/`models`/the default benchmark fail with `spawn fm ENOENT`.

The CLI reads the `fm` binary from the `FM_BIN` env var (or `--fm-bin <path>`). To exercise the full benchmark/report pipeline end-to-end here, point `FM_BIN` at a stub that emulates the subcommands `fm-bench` calls: `--help` (must print `Apple Foundation Models CLI` and/or a `MODELS` section), `available --model <m>`, `quota-usage --model <m>`, `token-count --quiet` (reads stdin, prints a token count), and `respond --model <m>` (reads the prompt on stdin, streams the answer to stdout). Example: `FM_BIN=/path/to/mock-fm node bin/fm-bench.js --models system --runs 2 --profile quick`.

These commands need **no** `fm` and work as-is: `legend`, `validate <report.json>`, `export <report.json>`, `compare <a.json> <b.json>`, `history <dir>`.
