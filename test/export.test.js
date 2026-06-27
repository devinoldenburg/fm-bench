import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { renderHtmlReport } from '../src/export.js';

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const report = JSON.parse(readFileSync(join(fixtureDir, 'fixtures/report-minimal.json'), 'utf8'));

test('renderHtmlReport embeds metadata and JSON', () => {
  const html = renderHtmlReport(report);
  assert.match(html, /fm-bench benchmark report/);
  assert.match(html, /Mac15,7/);
  assert.match(html, /&quot;tool&quot;: &quot;fm-bench&quot;/);
  assert.match(html, /schemaVersion/);
});