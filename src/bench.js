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
  const prompts = await loadPrompts(options);
  const inspection = await inspectModels(options);
  const modelStatuses = options.availableOnly
    ? inspection.models.filter((model) => model.available)
    : inspection.models;
  const runnableModels = modelStatuses.filter((model) => model.available);
  const environment = await collectEnvironment(inspection.fmBin);
  const promptTokenCounts = new Map();
  const concurrencies = normalizeConcurrencySweep(options);

  for (const prompt of prompts) {
    const counted = await countTokens(inspection.fmBin, prompt.prompt, options);
    promptTokenCounts.set(prompt.id, counted.ok ? counted.count : null);
  }

  const results = [];
  const scenarios = [];
  for (const concurrency of concurrencies) {
    const scenario = await runScenario({
      fmBin: inspection.fmBin,
      prompts,
      runnableModels,
      modelStatuses,
      promptTokenCounts,
      options,
      concurrency
    });
    scenarios.push(scenario);
    results.push(...scenario.results);
  }

  results.sort((a, b) => a.model.localeCompare(b.model)
    || (a.concurrency ?? 0) - (b.concurrency ?? 0)
    || a.promptId.localeCompare(b.promptId)
    || a.run - b.run);

  const summary = summarizeByModel(results, modelStatuses, { concurrencies });
  return {
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
}

async function runScenario(context) {
  const {
    fmBin,
    prompts,
    runnableModels,
    modelStatuses,
    promptTokenCounts,
    options,
    concurrency
  } = context;
  const startedAt = new Date().toISOString();

  for (let warmupIndex = 0; warmupIndex < options.warmup; warmupIndex += 1) {
    for (const model of runnableModels) {
      await respond(fmBin, model.name, prompts[0].prompt, {
        ...options,
        stream: false
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
  await runLimited(jobs, concurrency, async (job) => {
    const result = await runSingleBenchmark(fmBin, job, promptTokenCounts, options, benchmarkStartedAt);
    results.push(result);
    if (!result.ok && options.failFast) {
      const error = new Error(result.error || `Benchmark failed for ${job.model.name}`);
      error.exitCode = 1;
      throw error;
    }
  });

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
  const startOffsetMs = Number(process.hrtime.bigint() - benchmarkStartedAt) / 1e6;
  const response = await respond(fmBin, job.model.name, job.prompt.prompt, {
    ...options,
    stream: options.stream
  });
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
    promptTokens: promptTokenCounts.get(job.prompt.id),
    outputTokens: countedOutputTokens,
    chars,
    words,
    tokensPerSecond: countedOutputTokens != null && seconds > 0 ? countedOutputTokens / seconds : null,
    decodeTokensPerSecond,
    charsPerSecond: seconds > 0 ? chars / seconds : 0,
    startOffsetMs,
    endOffsetMs,
    streamed: response.streamed,
    stdoutChunks: response.stdoutChunks,
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

async function runLimited(items, concurrency, worker) {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
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
    profile: options.profile,
    promptCount: options.promptCount,
    greedy: options.greedy,
    stream: options.stream,
    slo: {
      ttftMs: options.sloTtftMs || null,
      e2eMs: options.sloE2eMs || null,
      tpotMs: options.sloTpotMs || null
    },
    instructions: options.instructions ? '[set]' : ''
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

function evaluateSlo(metrics, options) {
  const thresholds = [
    ['firstTokenMs', options.sloTtftMs],
    ['durationMs', options.sloE2eMs],
    ['tpotMs', options.sloTpotMs]
  ].filter(([, threshold]) => Number.isFinite(threshold));

  if (thresholds.length === 0) return null;

  return thresholds.every(([field, threshold]) => metrics[field] != null && metrics[field] <= threshold);
}
