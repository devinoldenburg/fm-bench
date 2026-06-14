import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeByModel, summarizeNumbers } from '../src/stats.js';

test('summarizeNumbers computes basic latency stats', () => {
  const summary = summarizeNumbers([30, 10, 20]);
  assert.equal(summary.min, 10);
  assert.equal(summary.max, 30);
  assert.equal(summary.avg, 20);
  assert.equal(summary.p50, 20);
});

test('summarizeByModel includes skipped unavailable models', () => {
  const summary = summarizeByModel([], [
    { name: 'pcc', description: 'cloud', available: false, reason: 'not available' }
  ]);

  assert.equal(summary[0].model, 'pcc');
  assert.equal(summary[0].available, false);
  assert.equal(summary[0].attempted, 0);
});
