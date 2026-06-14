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

  for (const prompt of prompts) {
    const counted = await countTokens(inspection.fmBin, prompt.prompt, options);
    promptTokenCounts.set(prompt.id, counted.ok ? counted.count : null);
  }

  for (let warmupIndex = 0; warmupIndex < options.warmup; warmupIndex += 1) {
    for (const model of runnableModels) {
      await respond(inspection.fmBin, model.name, prompts[0].prompt, {
        ...options,
        stream: false
      });
    }
  }

  const jobs = [];
  for (const model of runnableModels) {
    for (const prompt of prompts) {
      for (let run = 1; run <= options.runs; run += 1) {
        jobs.push({ model, prompt, run });
      }
    }
  }

  const results = [];
  await runLimited(jobs, Math.max(1, options.concurrency), async (job) => {
    const result = await runSingleBenchmark(inspection.fmBin, job, promptTokenCounts, options);
    results.push(result);
    if (!result.ok && options.failFast) {
      const error = new Error(result.error || `Benchmark failed for ${job.model.name}`);
      error.exitCode = 1;
      throw error;
    }
  });

  const summary = summarizeByModel(results, modelStatuses);
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
    summary,
    results
  };
}

async function runSingleBenchmark(fmBin, job, promptTokenCounts, options) {
  const response = await respond(fmBin, job.model.name, job.prompt.prompt, {
    ...options,
    stream: false
  });
  const outputTokens = response.ok
    ? await countTokens(fmBin, response.output, options)
    : { ok: false, count: null };
  const seconds = response.durationMs / 1000;
  const chars = response.output.length;
  const words = response.output.trim() ? response.output.trim().split(/\s+/).length : 0;

  return {
    model: job.model.name,
    promptId: job.prompt.id,
    run: job.run,
    ok: response.ok,
    durationMs: response.durationMs,
    promptTokens: promptTokenCounts.get(job.prompt.id),
    outputTokens: outputTokens.ok ? outputTokens.count : null,
    chars,
    words,
    tokensPerSecond: outputTokens.ok && seconds > 0 ? outputTokens.count / seconds : null,
    charsPerSecond: seconds > 0 ? chars / seconds : 0,
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
  return {
    models: normalizeModelSelection(options.models),
    runs: options.runs,
    warmup: options.warmup,
    concurrency: options.concurrency,
    timeoutMs: options.timeoutMs,
    profile: options.profile,
    promptCount: options.promptCount,
    greedy: options.greedy,
    instructions: options.instructions ? '[set]' : ''
  };
}
