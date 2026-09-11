import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { flattenResults, toCsv, writeReport } from '../src/report.js';

const results = [
  {
    model: 'system',
    concurrency: 1,
    promptId: 'p1',
    run: 1,
    attempts: 2,
    ok: true,
    durationMs: 1000.456,
    firstTokenMs: 120.2,
    generationMs: 880.256,
    tpotMs: 12.5,
    promptTokens: 20,
    outputTokens: 70,
    chars: 300,
    words: 50,
    tokensPerSecond: 70,
    decodeTokensPerSecond: 78,
    prefillTokensPerSecond: 166,
    charsPerSecond: 299,
    streamed: true,
    stdoutChunks: 5,
    secondChunkMs: 10,
    chunkGapAvgMs: 12,
    chunkGapMaxMs: 30,
    outputHash: 'abc123',
    good: null,
    error: ''
  },
  {
    model: 'system',
    concurrency: 1,
    promptId: 'p2',
    run: 1,
    attempts: 1,
    ok: false,
    durationMs: 250.5,
    firstTokenMs: null,
    generationMs: null,
    tpotMs: null,
    promptTokens: null,
    outputTokens: null,
    chars: 0,
    words: 0,
    tokensPerSecond: null,
    decodeTokensPerSecond: null,
    prefillTokensPerSecond: null,
    charsPerSecond: null,
    streamed: true,
    stdoutChunks: 0,
    secondChunkMs: null,
    chunkGapAvgMs: null,
    chunkGapMaxMs: null,
    outputHash: null,
    good: false,
    error: 'timed out after 250ms'
  }
];

test('flattenResults keeps unmeasurable metrics blank instead of zero', () => {
  const [ok, failed] = flattenResults(results);
  assert.equal(ok.attempts, 2);
  assert.equal(ok.tpot_ms, 12.5);
  assert.equal(failed.ttft_ms, '');
  assert.equal(failed.tpot_ms, '');
  assert.equal(failed.output_tokens, '');
  assert.equal(failed.chars_per_second, '');
  assert.equal(failed.error, 'timed out after 250ms');
});

test('toCsv emits a header plus one row per result', () => {
  const csv = toCsv(flattenResults(results));
  const lines = csv.split('\n');
  assert.equal(lines.length, 3);
  assert.match(lines[0], /^model,concurrency,prompt_id,run,attempts,ok,/);
  assert.match(lines[1], /^system,1,p1,1,2,true,/);
});

test('toCsv returns an empty string for no rows', () => {
  assert.equal(toCsv([]), '');
});

test('toCsv quotes separators and escapes embedded quotes', () => {
  const csv = toCsv([{ a: 'x,y', b: 'he said "hi"', c: 'line\nbreak' }]);
  assert.equal(csv, 'a,b,c\n"x,y","he said ""hi""","line\nbreak"');
});

test('toCsv neutralises spreadsheet formulas in untrusted text', () => {
  const csv = toCsv(flattenResults([
    { ...results[0], error: '=cmd|calc', outputHash: '+SUM(A1)', promptId: '@import' }
  ]));
  const row = csv.split('\n')[1];
  assert.match(row, /'=cmd\|calc/);
  assert.match(row, /'\+SUM\(A1\)/);
  assert.match(row, /'@import/);
});

test('toCsv keeps negative numbers numeric', () => {
  const csv = toCsv([{ delta: -12.5, note: '-looks like a flag' }]);
  assert.equal(csv.split('\n')[1], '-12.5,\'-looks like a flag');
});

test('writeReport writes JSON, CSV, and HTML from the real writers', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'fm-bench-report-'));
  const payload = {
    tool: 'fm-bench',
    version: '0.7.0',
    schemaVersion: '1',
    reportId: 'deadbeef',
    startedAt: '2026-09-11T00:00:00.000Z',
    finishedAt: '2026-09-11T00:01:00.000Z',
    options: { runs: 1, concurrency: 1, profile: 'quick' },
    environment: { platform: 'darwin', arch: 'arm64', hwModel: 'Mac17,9' },
    prompts: [{ id: 'p1', prompt: 'hi' }],
    summary: [],
    results
  };

  const jsonPath = await writeReport(join(dir, 'nested', 'report.json'), payload, 'json');
  assert.match(readFileSync(jsonPath, 'utf8'), /"tool": "fm-bench"/);

  const csvPath = await writeReport(join(dir, 'report.csv'), payload, 'csv');
  assert.match(readFileSync(csvPath, 'utf8'), /^model,concurrency,prompt_id/);

  const htmlPath = await writeReport(join(dir, 'report.html'), payload, 'html');
  assert.match(readFileSync(htmlPath, 'utf8'), /fm-bench benchmark report/);
});

test('writeReport refuses nothing and returns the resolved absolute path', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'fm-bench-report-'));
  const payload = { tool: 'fm-bench', version: '0.7.0', options: {}, environment: {}, summary: [], results: [] };
  const written = await writeReport(join(dir, 'sub', 'out.json'), payload, 'json');
  assert.ok(written.startsWith(dir));
  writeFileSync(join(dir, 'marker'), 'ok');
});
