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
test('renderHtmlReport escapes prompt text, notes, and embedded JSON', () => {
  const hostile = {
    ...report,
    options: { ...report.options, note: '<script>alert("note")</script>', tags: ['<img src=x onerror=1>'] },
    prompts: [{ id: 'x', prompt: '</pre><script>alert(1)</script>' }]
  };
  const html = renderHtmlReport(hostile);
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;script&gt;alert/);
  assert.match(html, /&quot;tool&quot;/);
});
