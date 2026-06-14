import test from 'node:test';
import assert from 'node:assert/strict';
import { renderBenchmarkReport } from '../src/table.js';
import { stripAnsi } from '../src/ansi.js';

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

test('renderBenchmarkReport explains CV color thresholds', () => {
  const report = renderBenchmarkReport(payload, { width: 120, ascii: true });
  assert.match(report, /CV = latency variation; lower is steadier: green <=10%, yellow <=25%, red >25%/);
});

test('renderBenchmarkReport colors cells without changing visible width', () => {
  const report = renderBenchmarkReport(payload, { width: 60, ascii: true, color: true });
  assert.match(report, /\u001b\[/);
  for (const line of report.split('\n')) {
    assert.ok(stripAnsi(line).length <= 60);
  }
});

test('renderBenchmarkReport uses green yellow and red metric colors', () => {
  const slowItem = JSON.parse(JSON.stringify(payload.summary[0]));
  slowItem.model = 'slow';
  slowItem.goodputRate = 0.5;
  slowItem.ttft = { p50: 260, p95: 310 };
  slowItem.latency = { p50: 1300, p95: 1600, p99: 1800, cv: 0.35, ci95Low: 1200, ci95High: 1700 };
  slowItem.tpot = { p50: 35, p95: 40 };
  slowItem.tokensPerSecond = { avg: 12 };
  slowItem.outputTokenThroughput = 14;
  slowItem.rps = 0.3;
  slowItem.decodeTokensPerSecond = { avg: 18 };

  const report = renderBenchmarkReport({
    ...payload,
    options: {
      ...payload.options,
      slo: {
        ttftMs: 200,
        e2eMs: 1000,
        tpotMs: 30
      }
    },
    summary: [
      {
        ...payload.summary[0],
        goodputRate: 1
      },
      slowItem
    ]
  }, { width: 160, ascii: true, color: true });

  assert.match(report, /\u001b\[32m/);
  assert.match(report, /\u001b\[33m/);
  assert.match(report, /\u001b\[31m/);
});
