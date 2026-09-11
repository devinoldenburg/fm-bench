import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCapabilitySummary, metricAvailability, metricDefinition, metricDefinitions } from '../src/metrics.js';

const fullFeatures = {
  tokenCounting: true,
  tokenCountCommand: 'count-tokens',
  quota: true,
  streaming: true
};

test('metricAvailability marks direct measurements available', () => {
  const metrics = metricAvailability({ features: fullFeatures }, { stream: true });
  assert.equal(metrics.e2eLatency.available, true);
  assert.equal(metrics.e2eLatency.kind, 'measured');
  assert.equal(metrics.rps.available, true);
  assert.equal(metrics.successRate.available, true);
  assert.equal(metrics.ttft.available, true);
  assert.equal(metrics.ttft.kind, 'proxy');
  assert.equal(metrics.ttft.unavailableReason, '');
});

test('metricAvailability marks token metrics unavailable without token counting', () => {
  const metrics = metricAvailability({
    features: { ...fullFeatures, tokenCounting: false, tokenCountCommand: null }
  }, { stream: true });
  for (const key of ['tpot', 'promptTokens', 'outputTokens', 'tokensPerSecond', 'decodeTokensPerSecond', 'prefillTokensPerSecond', 'outputTokenThroughput']) {
    assert.equal(metrics[key].available, false, `${key} should be unavailable`);
    assert.match(metrics[key].unavailableReason, /token/i);
  }
});

test('metricAvailability marks stream metrics unavailable without streaming', () => {
  const metrics = metricAvailability({ features: { ...fullFeatures, streaming: false } }, { stream: true });
  assert.equal(metrics.ttft.available, false);
  assert.equal(metrics.chunkGaps.available, false);
  assert.equal(metrics.generationMs.available, false);
  assert.match(metrics.ttft.unavailableReason, /stream/i);
  // E2E latency is still directly measurable without streaming.
  assert.equal(metrics.e2eLatency.available, true);
});

test('metricAvailability respects an explicit --no-stream run', () => {
  const metrics = metricAvailability({ features: fullFeatures }, { stream: false });
  assert.equal(metrics.ttft.available, false);
  assert.equal(metrics.e2eLatency.available, true);
});

test('metricAvailability ties goodput to configured SLOs', () => {
  const without = metricAvailability({ features: fullFeatures }, { stream: true });
  assert.equal(without.goodput.available, false);
  assert.match(without.goodput.unavailableReason, /--slo/);

  const withSlo = metricAvailability({ features: fullFeatures }, { stream: true, slo: true });
  assert.equal(withSlo.goodput.available, true);
});

test('metricAvailability reports quota from capability detection only', () => {
  const noQuota = metricAvailability({ features: { ...fullFeatures, quota: false } }, { stream: true });
  assert.equal(noQuota.quota.available, false);
  assert.equal(noQuota.quota.kind, 'measured');
  assert.match(noQuota.quota.unavailableReason, /quota command/);
});

test('every metric definition carries a source and a kind', () => {
  const kinds = new Set(['measured', 'proxy', 'derived', 'controlled']);
  for (const definition of metricDefinitions()) {
    assert.ok(kinds.has(definition.kind), `${definition.key} has kind ${definition.kind}`);
    assert.ok(definition.source.length > 0, `${definition.key} needs a source`);
    assert.ok(definition.requires.every((name) => ['streaming', 'tokenCounting', 'quota', 'slo'].includes(name)));
  }
  assert.equal(metricDefinition('tpot').kind, 'derived');
  assert.equal(metricDefinition('nope'), null);
});

test('formatCapabilitySummary is human readable', () => {
  assert.equal(formatCapabilitySummary({ features: fullFeatures }), 'token counting yes, streaming yes, quota yes');
  assert.equal(
    formatCapabilitySummary({ features: { tokenCounting: false, streaming: true, quota: false } }),
    'token counting no, streaming yes, quota no'
  );
});
