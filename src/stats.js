export function summarizeNumbers(values) {
  const clean = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (clean.length === 0) {
    return {
      count: 0,
      min: null,
      max: null,
      avg: null,
      sum: 0,
      stddev: null,
      cv: null,
      ci95Low: null,
      ci95High: null,
      p50: null,
      p90: null,
      p95: null,
      p99: null
    };
  }

  const total = clean.reduce((sum, value) => sum + value, 0);
  const avg = total / clean.length;
  const variance = clean.length > 1
    ? clean.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (clean.length - 1)
    : 0;
  const stddev = Math.sqrt(variance);
  const margin = clean.length > 1 ? tCritical95(clean.length) * (stddev / Math.sqrt(clean.length)) : 0;
  return {
    count: clean.length,
    min: clean[0],
    max: clean[clean.length - 1],
    avg,
    sum: total,
    stddev,
    cv: avg !== 0 ? stddev / Math.abs(avg) : null,
    ci95Low: avg - margin,
    ci95High: avg + margin,
    p50: percentile(clean, 50),
    p90: percentile(clean, 90),
    p95: percentile(clean, 95),
    p99: percentile(clean, 99)
  };
}

export function percentile(sortedValues, percentileValue) {
  if (sortedValues.length === 0) return null;
  if (sortedValues.length === 1) return sortedValues[0];

  const rank = (percentileValue / 100) * (sortedValues.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sortedValues[low];
  const weight = rank - low;
  return sortedValues[low] * (1 - weight) + sortedValues[high] * weight;
}

export function summarizeByModel(results, modelStatuses = [], options = {}) {
  const byModel = new Map();
  const concurrencies = options.concurrencies?.length ? options.concurrencies : [undefined];

  for (const concurrency of concurrencies) {
    for (const status of modelStatuses) {
      const key = summaryKey(status.name, concurrency);
      byModel.set(key, {
        model: status.name,
        concurrency,
        description: status.description,
        available: status.available,
        skippedReason: status.available ? '' : status.reason || 'Unavailable',
        results: []
      });
    }
  }

  for (const result of results) {
    const key = summaryKey(result.model, result.concurrency);
    if (!byModel.has(key)) {
      byModel.set(key, {
        model: result.model,
        concurrency: result.concurrency,
        description: '',
        available: true,
        skippedReason: '',
        results: []
      });
    }
    byModel.get(key).results.push(result);
  }

  return [...byModel.values()].map((entry) => {
    const successes = entry.results.filter((result) => result.ok);
    const failures = entry.results.filter((result) => !result.ok);
    const goodResults = successes.filter((result) => result.good === true);
    const goodMeasured = successes.filter((result) => result.good != null);
    const latency = summarizeNumbers(successes.map((result) => result.durationMs));
    const ttft = summarizeNumbers(successes.map((result) => result.firstTokenMs).filter((value) => value != null));
    const generation = summarizeNumbers(successes.map((result) => result.generationMs).filter((value) => value != null));
    const tpot = summarizeNumbers(successes.map((result) => result.tpotMs).filter((value) => value != null));
    const promptTokens = summarizeNumbers(successes.map((result) => result.promptTokens).filter((value) => value != null));
    const outputTokens = summarizeNumbers(successes.map((result) => result.outputTokens).filter((value) => value != null));
    const charsPerSecond = summarizeNumbers(successes.map((result) => result.charsPerSecond));
    const tokensPerSecond = summarizeNumbers(successes.map((result) => result.tokensPerSecond).filter((value) => value != null));
    const decodeTokensPerSecond = summarizeNumbers(successes.map((result) => result.decodeTokensPerSecond).filter((value) => value != null));
    const prefillTokensPerSecond = summarizeNumbers(successes.map((result) => result.prefillTokensPerSecond).filter((value) => value != null));
    const secondChunk = summarizeNumbers(successes.map((result) => result.secondChunkMs).filter((value) => value != null));
    const chunkGap = summarizeNumbers(successes.flatMap((result) => result.chunkGapsMs || []));
    const windowMs = modelWindowMs(successes);
    const rps = successes.length > 0 && windowMs > 0 ? successes.length / (windowMs / 1000) : null;
    const goodputRps = goodMeasured.length > 0 && windowMs > 0 ? goodResults.length / (windowMs / 1000) : null;
    const outputTokenThroughput = outputTokens.sum > 0 && windowMs > 0 ? outputTokens.sum / (windowMs / 1000) : null;
    const totalTokens = promptTokens.sum + outputTokens.sum;
    const totalTokenThroughput = totalTokens > 0 && windowMs > 0 ? totalTokens / (windowMs / 1000) : null;

    return {
      model: entry.model,
      concurrency: entry.concurrency,
      description: entry.description,
      available: entry.available,
      skippedReason: entry.skippedReason,
      attempted: entry.results.length,
      successes: successes.length,
      failures: failures.length,
      successRate: entry.results.length > 0 ? successes.length / entry.results.length : null,
      goodputRate: goodMeasured.length > 0 ? goodResults.length / goodMeasured.length : null,
      rps,
      goodputRps,
      outputTokenThroughput,
      totalTokenThroughput,
      repeatability: summarizeRepeatability(successes),
      latency,
      ttft,
      generation,
      tpot,
      promptTokens,
      outputTokens,
      charsPerSecond,
      tokensPerSecond,
      decodeTokensPerSecond,
      prefillTokensPerSecond,
      secondChunk,
      chunkGap
    };
  });
}

function summaryKey(model, concurrency) {
  return `${model}::${concurrency ?? 'default'}`;
}

function tCritical95(n) {
  const df = Math.max(1, n - 1);
  const table = {
    1: 12.706,
    2: 4.303,
    3: 3.182,
    4: 2.776,
    5: 2.571,
    6: 2.447,
    7: 2.365,
    8: 2.306,
    9: 2.262,
    10: 2.228,
    11: 2.201,
    12: 2.179,
    13: 2.16,
    14: 2.145,
    15: 2.131,
    16: 2.12,
    17: 2.11,
    18: 2.101,
    19: 2.093,
    20: 2.086,
    21: 2.08,
    22: 2.074,
    23: 2.069,
    24: 2.064,
    25: 2.06,
    26: 2.056,
    27: 2.052,
    28: 2.048,
    29: 2.045,
    30: 2.042
  };
  if (df <= 30) return table[df];
  if (df <= 60) return 2;
  return 1.96;
}

function modelWindowMs(results) {
  const starts = results.map((result) => result.startOffsetMs).filter((value) => Number.isFinite(value));
  const ends = results.map((result) => result.endOffsetMs).filter((value) => Number.isFinite(value));
  if (starts.length === 0 || ends.length === 0) return null;
  return Math.max(...ends) - Math.min(...starts);
}

function summarizeRepeatability(results) {
  const byPrompt = new Map();
  for (const result of results) {
    if (!result.outputHash) continue;
    if (!byPrompt.has(result.promptId)) byPrompt.set(result.promptId, []);
    byPrompt.get(result.promptId).push(result.outputHash);
  }

  const scores = [];
  for (const hashes of byPrompt.values()) {
    if (hashes.length < 2) continue;
    const counts = new Map();
    for (const hash of hashes) counts.set(hash, (counts.get(hash) || 0) + 1);
    scores.push(Math.max(...counts.values()) / hashes.length);
  }

  if (scores.length === 0) return null;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}
