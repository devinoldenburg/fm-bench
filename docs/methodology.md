# Methodology

`fm-bench` measures local `fm` command behavior from the client side. It is meant to answer: "What does this Mac deliver to a terminal user for this prompt suite right now?"

## Sources

The metric set follows common LLM inference benchmark practice:

- Apple introduces the macOS 27 `fm` command as a preinstalled way to use Foundation Models from the terminal and scripts: <https://developer.apple.com/videos/play/wwdc2026/334/>
- NVIDIA NIM benchmarking defines TTFT, end-to-end latency, inter-token latency / TPOT, tokens per second, and requests per second: <https://docs.nvidia.com/nim/benchmarking/llm/latest/metrics.html>
- NVIDIA GenAI-Perf reports TTFT, inter-token latency, request latency, sequence lengths, output token throughput, and JSON/CSV artifacts: <https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/perf_analyzer/genai-perf/README.html>
- NVIDIA AIPerf documents time to second token, inter-token latency, inter-chunk latency, per-user output throughput, and prefill throughput: <https://docs.nvidia.com/aiperf/reference/ai-perf-metrics-reference>
- vLLM benchmark tooling reports TTFT, TPOT, ITL, E2E percentiles and SLO-oriented goodput: <https://docs.vllm.ai/en/stable/cli/bench/serve/>
- MLCommons describes varying concurrency and reporting verified operating points for TTFT, throughput, interactivity, and response latency rather than interpolated performance: <https://mlcommons.org/2026/03/mlperf-endpoints-gen-ai-benchmarking/>
- MLPerf Client emphasizes local client workloads with multiple task types and varying prompt/response lengths: <https://mlcommons.org/benchmarks/client/>

## What `fm` can actually tell us

`fm-bench` never invents precision the CLI cannot provide. Every metric is classified by how it is obtained:

| Kind | Meaning |
|------|---------|
| **measured** | Observed directly: process wall clock, exit codes, stdout chunk arrival, `fm`-reported token counts. |
| **proxy** | Observed at a coarser granularity than the ideal metric (for example chunk arrival instead of token timestamps). |
| **derived** | Computed from measured values (for example output tokens divided by elapsed seconds). |
| **controlled** | An input setting rather than a measurement, such as the concurrency operating point. |

The same classification is machine-readable in every JSON report under `metrics` and in the CLI via `fm-bench legend` (SOURCE column). A metric the installed `fm` build cannot support is `available: false` with a reason, and renders as `-` rather than a plausible-looking number.

## Metrics

For a column-by-column terminal reference, run `fm-bench legend`.

- `TTFT` — *proxy*. Time from starting `fm respond` to the first streamed stdout chunk. `fm` exposes no per-token timestamps, so this is a terminal-side approximation of time to first token; the first chunk may already contain several tokens.
- `E2E latency` — *measured*. Time from starting `fm respond` until the process exits and the full response is captured.
- `generation_ms` — *derived*. `E2E - TTFT`, reported only when the answer arrives in more than one stdout chunk. When a single chunk carries the whole answer, prefill and decode are not separable and the value is unavailable instead of near zero.
- `TPOT` — *derived*. `(E2E - TTFT) / (output_tokens - 1)`, reported when the answer has at least three output tokens so the interval is an average over two or more decode tokens rather than the inverse of a single chunk gap. Requires streaming and a token-counting `fm`.
- `second_chunk_ms` — *proxy*. Time between the first and second streamed stdout chunks: a terminal-side signal for startup smoothness.
- `chunk_gap` — *proxy*. Distribution of time between consecutive streamed stdout chunks. Useful for spotting streaming jitter; chunk-based, not token-based.
- `prefill_tokens_per_second` — *proxy*. Input prompt tokens divided by TTFT seconds. Because TTFT includes process startup and first-token latency, this systematically understates true prefill speed and should be read as an upper-bound-constrained estimate, not a kernel measurement.
- `tokens_per_second` — *derived*. Output tokens divided by E2E seconds for one request.
- `decode_tokens_per_second` — *derived*. Output tokens after the first token divided by generation seconds.
- `output token throughput` — *derived*. All successful output tokens for a model divided by that model's measured wall-clock window.
- `total token throughput` — *derived*. Successful prompt and output tokens divided by the model's measured wall-clock window.
- `RPS` — *measured*. Successful requests divided by the model's measured wall-clock window.
- `goodput` — *derived*. Successful requests that also satisfy every provided SLO threshold. A run whose SLO metric is unavailable counts as not good, so an unverifiable SLO can never inflate goodput.
- `goodput RPS` — *derived*. SLO-passing requests divided by the model's measured wall-clock window. Zero is reported when SLOs are set and nothing passes.
- `repeatability` — *derived*. For repeated runs of the same prompt, the average share of runs that produced the most common normalized output hash.
- `CV` — *derived*. Sample standard deviation divided by the mean. Reported only with two or more successful samples.
- `95% CI` — *derived*. t-distribution confidence interval around the sample mean, using exact t critical values up to 30 degrees of freedom and the standard 2.0 / 1.96 approximations beyond that. Reported only with two or more successful samples. Treat it as context, not proof, at small sample sizes.
- `quota` — *measured*, when the `fm` build exposes a quota command. Most current builds do not, in which case `fm-bench` reports quota as unavailable rather than empty.

### Small samples

Statistics are computed over the successful samples of one model/concurrency row. With zero samples the row reports `null`; with one sample, percentiles and the mean are reported while spread metrics (`stddev`, `cv`, `ci95Low`, `ci95High`) are `null`. A single run cannot demonstrate stability, so `fm-bench` does not print `0%` variation for it.

## Operating Points

Use `--sweep-concurrency 1,2,4` to measure separate concurrency operating points. This follows the same idea as MLCommons endpoint reporting: a single peak number hides the tradeoff between system throughput and per-user responsiveness.

Use `--request-rate <rps>` to pace request starts independently of concurrency. Concurrency limits how many `fm respond` processes can be active at once; request rate controls how quickly new work is admitted. Use `--ramp-up-ms` to avoid instantly shocking a model or quota path when you start a higher-rate run.

`fm-bench` does not interpolate between operating points. It reports only what was actually measured.

## Warmups

`--warmup <n>` runs `n` unmeasured calls per model at the start of each operating point. The first `fm respond` after a cold start includes model load time, which can dominate a short prompt (observed at several hundred milliseconds on Apple silicon). Warmups are never mixed into the measured results.

## Failures and retries

A failed call is recorded as a failed measurement with its error text, and is excluded from latency and throughput statistics. `--retry <n>` retries failed calls with exponential backoff before recording the failure; the report keeps the run count and records the number of attempts separately, so a retried success is still one sample and never silently duplicates work.

## Prompt Profiles

The `client` profile is a pragmatic local-machine mix inspired by MLPerf Client's emphasis on multiple task categories and prompt/response lengths. It includes short chat, content generation, structured extraction, light summarization, and code analysis prompts. It is not a formal MLPerf submission suite; it is a convenient built-in workload for comparing your own Mac, OS build, and `fm` models over time.

## Caveats

Token counts come from the `fm` build's own token-counting command (`count-tokens` on current builds, `token-count` on older ones). If a build has no such command, token-derived metrics are reported as unavailable rather than estimated. `fm-bench` cannot judge semantic quality unless you provide your own prompt suite and inspect captured outputs with `--capture-output`.

Client-side measurements include process startup, local queueing, model prefill, streaming, detokenization, and terminal pipe overhead. That is intentional for a command-line benchmark, but it is not the same as an internal model-kernel benchmark.

Stream smoothness metrics use stdout chunk arrival times. A chunk can contain more than one token, and pipe buffering can affect chunk boundaries. Treat `second_chunk_ms` and `chunk_gap` as user-visible streaming diagnostics, not raw decoder telemetry.

For serious comparisons, prefer at least three runs per prompt, include warmups, benchmark both interactive and throughput or client profiles, compare models at the same concurrency operating points, set SLOs that match your real UX budget, and save JSON reports for later analysis.

## Report artifacts

Saved JSON includes client-side environment metadata (hardware model, macOS build, `fm` help digest, power/thermal snapshot) plus the detected `fm` capabilities and per-metric availability, so shared results remain interpretable on other machines. Use `fm-bench validate` before publishing and `fm-bench compare --strict` when you require identical prompt suites. Format details: [report-format.md](./report-format.md).
