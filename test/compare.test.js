import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { diffReports, renderCompareReport } from '../src/compare.js';

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const before = JSON.parse(readFileSync(join(fixtureDir, 'fixtures/report-minimal.json'), 'utf8'));
const after = JSON.parse(readFileSync(join(fixtureDir, 'fixtures/report-minimal.json'), 'utf8'));
after.summary[0].ttft.p50 = 250;
after.summary[0].latency.p95 = 2800;

test('diffReports includes compatibility block', () => {
  const diff = diffReports(before, after);
  assert.ok(diff.compatibility);
  assert.equal(diff.compatibility.suiteMatch, true);
  assert.equal(diff.rows.length, 1);
  assert.equal(diff.rows[0].ttftP50.delta, -50);
});

test('renderCompareReport mentions suite warning when mismatched', () => {
  const mismatched = {
    ...after,
    options: { ...after.options, profile: 'quick' }
  };
  const diff = diffReports(before, mismatched);
  const text = renderCompareReport(diff, { color: false, ascii: true });
  assert.match(text, /warn:/);
});

test('renderCompareReport includes macOS build metadata', () => {
  const beta3 = {
    ...after,
    environment: {
      ...after.environment,
      macOS: 'ProductVersion:\t27.0\nBuildVersion:\t26A5378j'
    }
  };
  const diff = diffReports(before, beta3);
  const text = renderCompareReport(diff, { color: false, ascii: true });
  assert.match(text, /macOS 27\.0 \(25A123\)/);
  assert.match(text, /macOS 27\.0 \(26A5378j\)/);
  assert.match(text, /macOS build differs/);
});
