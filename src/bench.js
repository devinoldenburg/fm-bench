import crypto from 'node:crypto';
import { checkModelAvailability, collectEnvironment, countTokens, discoverModels, getQuotaUsage, respond } from './fm.js';
import { loadPrompts } from './prompts.js';
import { summarizeByModel } from './stats.js';

export async function inspectModels(options = {}) {
  const discovered = await discoverModels(options);
  const requested = normalizeModelSelection(options.models);
  const models = requested.length > 0
    ? discovered.models.filter((model) => requested.includes(model.name))
    : discovered.models;

  const missing = requested.filter((name) => !models.some((model) => model.name === name));
  for (const name of missing) {
    models.push({ name, description: 'Requested model not reported by fm --help' });
  }

  const inspected = [];
  for (const model of models) {
    const availability = await checkModelAvailability(discovered.fmBin, model.name, options);
    const quota = await getQuotaUsage(discovered.fmBin, model.name, options);
    inspected.push({
      ...model,
      available: availability.available,
      reason: availability.reason || availability.raw,
      quota: quota.raw
    });
  }

  return {
    fmBin: discovered.fmBin,
    models: inspected,
    help: discovered.help
  };
}

export async function runBenchmark(options = {}) {
  const startedAt = new Date().toISOString();
  notify(options, { type: 'phase', phase: 'prompts', message: 'loading prompts' });
  const prompts = await loadPrompts(options);
  notify(options, { type: 'phase', phase: 'models', message: 'discovering models' });
  const inspection = await inspectModels(options);
  const modelStatuses = options.availableOnly
    ? inspection.models.filter((model) => model.available)
    : inspection.models;
  const runnableModels = modelStatuses.filter((model) => model.available);
  const environment = await collectEnvironment(inspection.fmBin);
  const promptTokenCounts = new Map();
  const concurrencies = normalizeConcurrencySweep(options);
  const totalRuns = concurrencies.length * runnableModels.length * prompts.length * options.runs;

  notify(options, {
    type: 'tokens:start',
    total: prompts.length,
    message: 'counting prompt tokens'
  });
  for (const prompt of prompts) {
    const counted = await countTokens(inspection.fmBin, prompt.prompt, options);
    promptTokenCounts.set(prompt.id, counted.ok ? counted.count : null);
    notify(options, {
      type: 'tokens:progress',
      completed: promptTokenCounts.size,
      total: prompts.length,
      promptId: prompt.id
    });
  }

  const results = [];
  const scenarios = [];
  let completedRuns = 0;
  let failedRuns = 0;
  notify(options, {
    type: 'benchmark:start',
    total: totalRuns,
    modelCount: runnableModels.length,
    promptCount: prompts.length,
    scenarioCount: concurrencies.length
  });
  for (const [scenarioIndex, concurrency] of concurrencies.entries()) {
    const scenario = await runScenario({
      fmBin: inspection.fmBin,
      prompts,
      runnableModels,
      modelStatuses,
      promptTokenCounts,
      options,
      concurrency,
      scenarioIndex: scenarioIndex + 1,
      scenarioCount: concurrencies.length,
      onMeasuredResult: (result) => {
        completedRuns += 1;
        if (!result.ok) failedRuns += 1;
        notify(options, {
          type: 'benchmark:progress',
          completed: completedRuns,
          failed: failedRuns,
          total: totalRuns,
          concurrency,
          model: result.model,
          promptId: result.promptId,
          run: result.run,
          ok: result.ok,
          durationMs: result.durationMs,
          firstTokenMs: result.firstTokenMs
        });
      }
    });
    scenarios.push(scenario);
    results.push(...scenario.results);
  }

  results.sort((a, b) => a.model.localeCompare(b.model)
    || (a.concurrency ?? 0) - (b.concurrency ?? 0)
    || a.promptId.localeCompare(b.promptId)
    || a.run - b.run);

  const summary = summarizeByModel(results, modelStatuses, { concurrencies });
  const payload = {
    tool: 'fm-bench',
    version: options.version,
    startedAt,
    finishedAt: new Date().toISOString(),
    options: publicOptions(options),
    environment,
    prompts: prompts.map((prompt) => ({
      id: prompt.id,
      prompt: prompt.prompt,
      promptTokens: promptTokenCounts.get(prompt.id)
    })),
    models: modelStatuses,
    scenarios,
    summary,
    results
  };
  notify(options, {
    type: 'benchmark:complete',
    completed: completedRuns,
    failed: failedRuns,
    total: totalRuns
  });
  return payload;
}

async function runScenario(context) {
  const {
    fmBin,
    prompts,
    runnableModels,
    modelStatuses,
    promptTokenCounts,
    options,
    concurrency,
    scenarioIndex,
    scenarioCount,
    onMeasuredResult
  } = context;
  const startedAt = new Date().toISOString();

  const warmupTotal = options.warmup * runnableModels.length;
  if (warmupTotal > 0) {
    notify(options, {
      type: 'warmup:start',
      concurrency,
      scenarioIndex,
      scenarioCount,
      total: warmupTotal
    });
  }
  let warmupCompleted = 0;
  for (let warmupIndex = 0; warmupIndex < options.warmup; warmupIndex += 1) {
    for (const model of runnableModels) {
      await respond(fmBin, model.name, prompts[0].prompt, {
        ...options,
        stream: false
      });
      warmupCompleted += 1;
      notify(options, {
        type: 'warmup:progress',
        concurrency,
        scenarioIndex,
        scenarioCount,
        completed: warmupCompleted,
        total: warmupTotal,
        model: model.name
      });
    }
  }

  const jobs = [];
  const benchmarkStartedAt = process.hrtime.bigint();
  for (const model of runnableModels) {
    for (const prompt of prompts) {
      for (let run = 1; run <= options.runs; run += 1) {
        jobs.push({ model, prompt, run, concurrency });
      }
    }
  }

  const results = [];
  notify(options, {
    type: 'scenario:start',
    concurrency,
    scenarioIndex,
    scenarioCount,
    total: jobs.length
  });
  await runLimited(jobs, concurrency, async (job) => {
    const result = await runSingleBenchmark(fmBin, job, promptTokenCounts, options, benchmarkStartedAt);
    results.push(result);
    if (onMeasuredResult) onMeasuredResult(result);
    if (!result.ok && options.failFast) {
      const error = new Error(result.error || `Benchmark failed for ${job.model.name}`);
      error.exitCode = 1;
      throw error;
    }
  }, options);

  results.sort((a, b) => a.model.localeCompare(b.model)
    || a.promptId.localeCompare(b.promptId)
    || a.run - b.run);

  return {
    concurrency,
    startedAt,
    finishedAt: new Date().toISOString(),
    summary: summarizeByModel(results, modelStatuses, { concurrencies: [concurrency] }),
    results
  };
}

async function runSingleBenchmark(fmBin, job, promptTokenCounts, options, benchmarkStartedAt) {
  const maxAttempts = 1 + Math.max(0, options.retry ?? 0);
  const startOffsetMs = Number(process.hrtime.bigint() - benchmarkStartedAt) / 1e6;
  let response;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    response = await respond(fmBin, job.model.name, job.prompt.prompt, {
      ...options,
      stream: options.stream
    });
    if (response.ok || attempt >= maxAttempts) break;
    const backoffMs = Math.min(500 * 2 ** (attempt - 1), 4000);
    await new Promise((resolve) => setTimeout(resolve, backoffMs));
  }
  const endOffsetMs = Number(process.hrtime.bigint() - benchmarkStartedAt) / 1e6;
  const outputTokens = response.ok
    ? await countTokens(fmBin, response.output, options)
    : { ok: false, count: null };
  const seconds = response.durationMs / 1000;
  const firstTokenMs = response.firstOutputMs;
  const generationMs = response.ok && firstTokenMs != null
    ? Math.max(0, response.durationMs - firstTokenMs)
    : null;
  const countedOutputTokens = outputTokens.ok ? outputTokens.count : null;
  const decodeTokenCount = countedOutputTokens != null ? Math.max(0, countedOutputTokens - 1) : null;
  const hasDecodeCadence = response.stdoutChunks > 2 && generationMs != null && generationMs > 0 && decodeTokenCount > 0;
  const tpotMs = hasDecodeCadence ? generationMs / decodeTokenCount : null;
  const decodeTokensPerSecond = hasDecodeCadence
    ? decodeTokenCount / (generationMs / 1000)
    : null;
  const chars = response.output.length;
  const words = response.output.trim() ? response.output.trim().split(/\s+/).length : 0;
  const promptTokens = promptTokenCounts.get(job.prompt.id);
  const prefillTokensPerSecond = promptTokens != null && firstTokenMs > 0
    ? promptTokens / (firstTokenMs / 1000)
    : null;
  const chunkGapsMs = chunkGaps(response.stdoutChunkTimesMs);
  const secondChunkMs = chunkGapsMs.length > 0 ? chunkGapsMs[0] : null;

  return {
    model: job.model.name,
    concurrency: job.concurrency,
    promptId: job.prompt.id,
    run: job.run,
    ok: response.ok,
    durationMs: response.durationMs,
    firstTokenMs,
    generationMs,
    tpotMs,
    promptTokens,
    outputTokens: countedOutputTokens,
    chars,
    words,
    tokensPerSecond: countedOutputTokens != null && seconds > 0 ? countedOutputTokens / seconds : null,
    decodeTokensPerSecond,
    prefillTokensPerSecond,
    charsPerSecond: seconds > 0 ? chars / seconds : 0,
    startOffsetMs,
    endOffsetMs,
    streamed: response.streamed,
    stdoutChunks: response.stdoutChunks,
    secondChunkMs,
    chunkGapsMs,
    chunkGapAvgMs: average(chunkGapsMs),
    chunkGapMaxMs: chunkGapsMs.length > 0 ? Math.max(...chunkGapsMs) : null,
    outputHash: response.ok ? hashOutput(response.output) : null,
    good: response.ok ? evaluateSlo({
      firstTokenMs,
      durationMs: response.durationMs,
      tpotMs
    }, options) : false,
    output: options.captureOutput ? response.output : undefined,
    error: response.ok ? '' : response.stderr || `fm exited with code ${response.code ?? response.signal}`
  };
}

async function runLimited(items, concurrency, worker, options = {}) {
  let nextIndex = 0;
  const waitForSlot = createPacer(options.requestRate, options.rampUpMs);
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await waitForSlot(index);
      await worker(items[index]);
    }
  });
  await Promise.all(workers);
}

function normalizeModelSelection(models) {
  if (!models) return [];
  const values = Array.isArray(models) ? models : [models];
  return values.flatMap((value) => String(value).split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}

function publicOptions(options) {
  const concurrencies = normalizeConcurrencySweep(options);
  return {
    models: normalizeModelSelection(options.models),
    runs: options.runs,
    warmup: options.warmup,
    concurrency: options.concurrency,
    sweepConcurrency: concurrencies.length > 1 ? concurrencies : [],
    timeoutMs: options.timeoutMs,
    requestRate: options.requestRate || null,
    rampUpMs: options.rampUpMs || null,
    profile: options.profile,
    promptCount: options.promptCount,
    greedy: options.greedy,
    stream: options.stream,
    slo: {
      ttftMs: options.sloTtftMs || null,
      e2eMs: options.sloE2eMs || null,
      tpotMs: options.sloTpotMs || null
    },
    instructions: options.instructions ? '[set]' : '',
    retry: options.retry ?? 0
  };
}

function normalizeConcurrencySweep(options) {
  if (options.sweepConcurrency?.length) {
    return [...new Set(options.sweepConcurrency)]
      .filter((value) => Number.isInteger(value) && value > 0)
      .sort((a, b) => a - b);
  }
  return [Math.max(1, options.concurrency || 1)];
}

function hashOutput(output) {
  return crypto.createHash('sha256')
    .update(output.replace(/\s+/g, ' ').trim())
    .digest('hex')
    .slice(0, 16);
}

function chunkGaps(times = []) {
  const gaps = [];
  for (let index = 1; index < times.length; index += 1) {
    gaps.push(Math.max(0, times[index] - times[index - 1]));
  }
  return gaps;
}

function average(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (clean.length === 0) return null;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function createPacer(requestRate, rampUpMs = 0) {
  if (!Number.isFinite(requestRate) || requestRate <= 0) {
    return async () => {};
  }

  const startedAt = process.hrtime.bigint();
  const offsets = [];
  const steadyIntervalMs = 1000 / requestRate;
  const warmIntervalMs = steadyIntervalMs * 4;

  return async (index) => {
    while (offsets.length <= index) {
      const previousOffset = offsets.length === 0 ? 0 : offsets[offsets.length - 1];
      const fraction = rampUpMs > 0 ? Math.min(1, previousOffset / rampUpMs) : 1;
      const interval = warmIntervalMs + ((steadyIntervalMs - warmIntervalMs) * fraction);
      offsets.push(offsets.length === 0 ? 0 : previousOffset + interval);
    }

    const targetMs = offsets[index];
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const waitMs = targetMs - elapsedMs;
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  };
}

function notify(options, event) {
  if (typeof options.onProgress === 'function') {
    options.onProgress(event);
  }
}

function evaluateSlo(metrics, options) {
  const thresholds = [
    ['firstTokenMs', options.sloTtftMs],
    ['durationMs', options.sloE2eMs],
    ['tpotMs', options.sloTpotMs]
  ].filter(([, threshold]) => Number.isFinite(threshold));

  if (thresholds.length === 0) return null;

  return thresholds.every(([field, threshold]) => metrics[field] != null && metrics[field] <= threshold);
}
