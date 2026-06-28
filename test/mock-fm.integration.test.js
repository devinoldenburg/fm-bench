import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const mockFm = path.join(root, 'scripts', 'mock-fm.sh');
const cli = path.join(root, 'bin', 'fm-bench.js');

function runBenchJson() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      cli,
      '--models', 'system',
      '--runs', '1',
      '--profile', 'quick',
      '--format', 'json'
    ], {
      cwd: root,
      env: { ...process.env, FM_BIN: mockFm },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '';
    child.stdout.on('data', (c) => { out += c; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`exit ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(out));
      } catch (err) {
        reject(err);
      }
    });
  });
}

test('mock-fm runs quick benchmark and emits schema fields', async () => {
  const report = await runBenchJson();
  assert.equal(report.tool, 'fm-bench');
  assert.ok(Array.isArray(report.results));
  assert.ok(report.results.length >= 1);
});