export function summarizeNumbers(values) {
  const clean = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (clean.length === 0) {
    return {
      count: 0,
      min: null,
      max: null,
      avg: null,
      sum: 0,
      p50: null,
      p90: null,
      p95: null,
      p99: null
    };
  }

  const total = clean.reduce((sum, value) => sum + value, 0);
  return {
    count: clean.length,
    min: clean[0],
    max: clean[clean.length - 1],
    avg: total / clean.length,
    sum: total,
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

export function summarizeByModel(results, modelStatuses = []) {
  const byModel = new Map();

  for (const status of modelStatuses) {
    byModel.set(status.name, {
      model: status.name,
      description: status.description,
      available: status.available,
      skippedReason: status.available ? '' : status.reason || 'Unavailable',
      results: []
    });
  }

  for (const result of results) {
    if (!byModel.has(result.model)) {
      byModel.set(result.model, {
        model: result.model,
        description: '',
        available: true,
        skippedReason: '',
        results: []
      });
    }
    byModel.get(result.model).results.push(result);
  }

  return [...byModel.values()].map((entry) => {
    const successes = entry.results.filter((result) => result.ok);
    const failures = entry.results.filter((result) => !result.ok);
    const latency = summarizeNumbers(successes.map((result) => result.durationMs));
    const ttft = summarizeNumbers(successes.map((result) => result.firstTokenMs).filter((value) => value != null));
    const generation = summarizeNumbers(successes.map((result) => result.generationMs).filter((value) => value != null));
    const tpot = summarizeNumbers(successes.map((result) => result.tpotMs).filter((value) => value != null));
    const promptTokens = summarizeNumbers(successes.map((result) => result.promptTokens).filter((value) => value != null));
    const outputTokens = summarizeNumbers(successes.map((result) => result.outputTokens).filter((value) => value != null));
    const charsPerSecond = summarizeNumbers(successes.map((result) => result.charsPerSecond));
    const tokensPerSecond = summarizeNumbers(successes.map((result) => result.tokensPerSecond).filter((value) => value != null));
    const decodeTokensPerSecond = summarizeNumbers(successes.map((result) => result.decodeTokensPerSecond).filter((value) => value != null));
    const windowMs = modelWindowMs(successes);
    const rps = successes.length > 0 && windowMs > 0 ? successes.length / (windowMs / 1000) : null;
    const outputTokenThroughput = outputTokens.sum > 0 && windowMs > 0 ? outputTokens.sum / (windowMs / 1000) : null;

    return {
      model: entry.model,
      description: entry.description,
      available: entry.available,
      skippedReason: entry.skippedReason,
      attempted: entry.results.length,
      successes: successes.length,
      failures: failures.length,
      successRate: entry.results.length > 0 ? successes.length / entry.results.length : null,
      rps,
      outputTokenThroughput,
      repeatability: summarizeRepeatability(successes),
      latency,
      ttft,
      generation,
      tpot,
      promptTokens,
      outputTokens,
      charsPerSecond,
      tokensPerSecond,
      decodeTokensPerSecond
    };
  });
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
