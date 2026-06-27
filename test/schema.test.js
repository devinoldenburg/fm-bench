import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import {
  compareCompatibility,
  finalizeReportPayload,
  isFmBenchReport,
  suiteKey,
  validateReport
} from '../src/schema.js';

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const minimal = JSON.parse(readFileSync(join(fixtureDir, 'fixtures/report-minimal.json'), 'utf8'));

test('validateReport accepts minimal fixture', () => {
  const result = validateReport(minimal);
  assert.equal(result.ok, true);
});

test('isFmBenchReport rejects non-reports', () => {
  assert.equal(isFmBenchReport(null), false);
  assert.equal(isFmBenchReport({ tool: 'other' }), false);
});

test('finalizeReportPayload adds schema and suite', () => {
  const out = finalizeReportPayload({
    tool: 'fm-bench',
    version: '0.6.0',
    startedAt: '2026-06-27T12:00:00.000Z',
    options: { profile: 'quick', runs: 1, concurrency: 1, sweepConcurrency: [] },
    environment: { platform: 'darwin' },
    prompts: [{ id: 'a' }],
    summary: [],
    results: []
  });
  assert.equal(out.schemaVersion, '1');
  assert.ok(out.reportId);
  assert.equal(out.suite.profile, 'quick');
  assert.equal(out.suite.promptCount, 1);
});

test('suiteKey is stable for identical suites', () => {
  const a = suiteKey(minimal);
  const b = suiteKey({ ...minimal, reportId: 'other' });
  assert.equal(a, b);
});

test('compareCompatibility warns on suite mismatch', () => {
  const after = {
    ...minimal,
    options: { ...minimal.options, profile: 'stress', runs: 5 }
  };
  const compat = compareCompatibility(minimal, after);
  assert.equal(compat.compatible, true);
  assert.equal(compat.suiteMatch, false);
  assert.ok(compat.warnings.some((w) => w.includes('suites differ')));
});