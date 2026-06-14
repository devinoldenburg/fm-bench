export function summarizeNumbers(values) {
  const clean = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (clean.length === 0) {
    return {
      count: 0,
      min: null,
      max: null,
      avg: null,
      p50: null,
      p95: null
    };
  }

  const total = clean.reduce((sum, value) => sum + value, 0);
  return {
    count: clean.length,
    min: clean[0],
    max: clean[clean.length - 1],
    avg: total / clean.length,
    p50: percentile(clean, 50),
    p95: percentile(clean, 95)
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
    const outputTokens = summarizeNumbers(successes.map((result) => result.outputTokens).filter((value) => value != null));
    const charsPerSecond = summarizeNumbers(successes.map((result) => result.charsPerSecond));
    const tokensPerSecond = summarizeNumbers(successes.map((result) => result.tokensPerSecond).filter((value) => value != null));

    return {
      model: entry.model,
      description: entry.description,
      available: entry.available,
      skippedReason: entry.skippedReason,
      attempted: entry.results.length,
      successes: successes.length,
      failures: failures.length,
      latency,
      outputTokens,
      charsPerSecond,
      tokensPerSecond
    };
  });
}
