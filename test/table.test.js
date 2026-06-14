import test from 'node:test';
import assert from 'node:assert/strict';
import { renderBenchmarkReport } from '../src/table.js';

const payload = {
  version: '0.3.0',
  startedAt: '2026-06-14T00:00:00.000Z',
  finishedAt: '2026-06-14T00:00:02.000Z',
  environment: {
    platform: 'darwin',
    arch: 'arm64',
    fmBin: 'fm'
  },
  options: {
    runs: 2,
    concurrency: 1,
    sweepConcurrency: [1, 2],
    stream: true
  },
  prompts: [{ id: 'p1' }],
  summary: [
    {
      model: 'system',
      concurrency: 1,
      available: true,
      attempted: 2,
      successes: 2,
      failures: 0,
      successRate: 1,
      rps: 1.5,
      outputTokenThroughput: 42,
      repeatability: 1,
      skippedReason: '',
      description: 'local',
      ttft: { p50: 120, p95: 140 },
      latency: { p50: 900, p95: 1100, p99: 1120, cv: 0.1, ci95Low: 800, ci95High: 1200 },
      tpot: { p50: 12, p95: 15 },
      tokensPerSecond: { avg: 40 },
      promptTokens: { avg: 30 },
      outputTokens: { avg: 90 },
      decodeTokensPerSecond: { avg: 80 }
    }
  ]
};

test('renderBenchmarkReport uses compact layout for narrow width', () => {
  const report = renderBenchmarkReport(payload, { width: 60, ascii: true });
  assert.match(report, /system c1 ok 2\/2/);
  for (const line of report.split('\n')) {
    assert.ok(line.length <= 60);
  }
});

test('renderBenchmarkReport includes sweep concurrency in header', () => {
  const report = renderBenchmarkReport(payload, { width: 120, ascii: true });
  assert.match(report, /concurrency 1,2/);
  assert.match(report, /\| C \| MODEL/);
  assert.match(report, /\| 1 \| system/);
});
