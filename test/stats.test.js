import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeByModel, summarizeNumbers } from '../src/stats.js';

test('summarizeNumbers computes basic latency stats', () => {
  const summary = summarizeNumbers([30, 10, 20]);
  assert.equal(summary.min, 10);
  assert.equal(summary.max, 30);
  assert.equal(summary.avg, 20);
  assert.equal(summary.p50, 20);
  assert.equal(summary.p90, 28);
  assert.ok(Math.abs(summary.p99 - 29.8) < 0.0001);
});

test('summarizeByModel includes skipped unavailable models', () => {
  const summary = summarizeByModel([], [
    { name: 'pcc', description: 'cloud', available: false, reason: 'not available' }
  ]);

  assert.equal(summary[0].model, 'pcc');
  assert.equal(summary[0].available, false);
  assert.equal(summary[0].attempted, 0);
});

test('summarizeByModel computes streaming and throughput metrics', () => {
  const summary = summarizeByModel([
    {
      model: 'system',
      promptId: 'p1',
      ok: true,
      durationMs: 1000,
      firstTokenMs: 200,
      generationMs: 800,
      tpotMs: 100,
      promptTokens: 20,
      outputTokens: 9,
      tokensPerSecond: 9,
      decodeTokensPerSecond: 10,
      charsPerSecond: 90,
      startOffsetMs: 0,
      endOffsetMs: 1000,
      outputHash: 'a'
    },
    {
      model: 'system',
      promptId: 'p1',
      ok: true,
      durationMs: 1200,
      firstTokenMs: 300,
      generationMs: 900,
      tpotMs: 112.5,
      promptTokens: 20,
      outputTokens: 9,
      tokensPerSecond: 7.5,
      decodeTokensPerSecond: 8.9,
      charsPerSecond: 70,
      startOffsetMs: 1000,
      endOffsetMs: 2200,
      outputHash: 'a'
    }
  ], [
    { name: 'system', description: 'local', available: true }
  ]);

  assert.equal(summary[0].successes, 2);
  assert.equal(summary[0].ttft.p50, 250);
  assert.equal(summary[0].outputTokenThroughput, 18 / 2.2);
  assert.equal(summary[0].repeatability, 1);
});
