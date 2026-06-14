# Methodology

`fm-bench` measures local `fm` command behavior from the client side. It is meant to answer: "What does this Mac deliver to a terminal user for this prompt suite right now?"

## Sources

The metric set follows common LLM inference benchmark practice:

- Apple introduces the macOS 27 `fm` command as a preinstalled way to use Foundation Models from the terminal and scripts: <https://developer.apple.com/videos/play/wwdc2026/334/>
- NVIDIA NIM benchmarking defines TTFT, end-to-end latency, inter-token latency / TPOT, tokens per second, and requests per second: <https://docs.nvidia.com/nim/benchmarking/llm/latest/metrics.html>
- NVIDIA GenAI-Perf reports TTFT, inter-token latency, request latency, sequence lengths, output token throughput, and JSON/CSV artifacts: <https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/perf_analyzer/genai-perf/README.html>
- vLLM benchmark tooling reports TTFT, TPOT, ITL, E2E percentiles and SLO-oriented goodput: <https://docs.vllm.ai/en/stable/cli/bench/serve/>
- MLCommons describes varying concurrency and reporting verified operating points for TTFT, throughput, interactivity, and response latency rather than interpolated performance: <https://mlcommons.org/2026/03/mlperf-endpoints-gen-ai-benchmarking/>
- MLPerf Client emphasizes local client workloads with multiple task types and varying prompt/response lengths: <https://mlcommons.org/benchmarks/client/>

## Metrics

- `TTFT`: time from starting `fm respond` to the first streamed stdout chunk. This is a practical terminal-side proxy for time to first token.
- `E2E latency`: time from starting `fm respond` until the process exits and the full response is captured.
- `generation_ms`: `E2E - TTFT`.
- `TPOT`: `(E2E - TTFT) / (output_tokens - 1)`. The first output token is excluded so TPOT focuses on decode cadence.
- `tokens_per_second`: output tokens divided by E2E seconds for one request.
- `decode_tokens_per_second`: output tokens after the first token divided by generation seconds.
- `total output token throughput`: all successful output tokens for a model divided by that model's measured wall-clock window.
- `RPS`: successful requests divided by that model's measured wall-clock window.
- `goodput`: successful requests that also satisfy all provided SLO thresholds.
- `repeatability`: for repeated runs of the same prompt, the average share of runs that produced the most common normalized output hash.
- `CV`: coefficient of variation, or sample standard deviation divided by the mean. Lower values indicate steadier latency for that metric.
- `95% CI`: a t-distribution confidence interval around the sample mean. Treat it as useful context, not proof, especially with very small sample sizes.

## Operating Points

Use `--sweep-concurrency 1,2,4` to measure separate concurrency operating points. This follows the same idea as MLCommons endpoint reporting: a single peak number hides the tradeoff between system throughput and per-user responsiveness.

`fm-bench` does not interpolate between operating points. It reports only what was actually measured.

## Caveats

`fm-bench` uses `fm token-count --quiet` as the source of token counts, so token values follow Apple's local tokenizer behavior. It does not judge semantic quality unless you provide your own prompt suite and inspect captured outputs with `--capture-output`.

Client-side measurements include process startup, local queueing, model prefill, streaming, detokenization, and terminal pipe overhead. That is intentional for a command-line benchmark, but it is not the same as an internal model-kernel benchmark.

For serious comparisons, prefer at least three runs per prompt, include warmups, benchmark both interactive and throughput profiles, and compare models at the same concurrency operating points.
