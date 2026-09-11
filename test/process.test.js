import test from 'node:test';
import assert from 'node:assert/strict';
import { activeChildCount, killActiveChildren, runProcess } from '../src/process.js';
import { fakeFmPath } from './helpers.js';

test('runProcess captures stdout, exit code, and chunk timings', async () => {
  const result = await runProcess(fakeFmPath(), ['respond', '--model', 'system'], {
    input: 'hello',
    timeoutMs: 5_000
  });
  assert.equal(result.code, 0);
  assert.match(result.stdout, /deterministic answer/);
  assert.ok(result.durationMs > 0);
  assert.equal(result.timedOut, false);
  assert.ok(result.stdoutChunks >= 1);
  assert.ok(result.stdoutChunkTimesMs.length === result.stdoutChunks);
  assert.equal(result.error, null);
  assert.equal(activeChildCount(), 0);
});

test('runProcess reports a missing binary as an error without throwing', async () => {
  const result = await runProcess('/definitely/not/a/binary', ['--help'], { timeoutMs: 2_000 });
  assert.ok(result.error);
  assert.equal(result.code, null);
  assert.match(result.stderr, /ENOENT|not a binary/);
});

test('runProcess kills a process that exceeds its timeout', async () => {
  const result = await runProcess(fakeFmPath(), ['respond'], {
    input: 'slow',
    timeoutMs: 150,
    env: { ...process.env, FAKE_FM_SCENARIO: 'timeout' }
  });
  assert.equal(result.timedOut, true);
  assert.ok(['SIGTERM', 'SIGKILL'].includes(result.signal));
  assert.ok(result.durationMs < 5_000);
  assert.equal(activeChildCount(), 0);
});

test('killActiveChildren terminates running children and the pending call resolves', async () => {
  const pending = runProcess(fakeFmPath(), ['respond'], {
    input: 'interrupt',
    timeoutMs: 60_000,
    env: { ...process.env, FAKE_FM_SCENARIO: 'interrupt' }
  });

  // Wait until the child is actually tracked before signalling it.
  for (let attempt = 0; attempt < 100 && activeChildCount() === 0; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(activeChildCount(), 1);

  const killed = killActiveChildren('SIGTERM');
  assert.equal(killed, 1);

  const result = await pending;
  assert.equal(result.timedOut, false);
  assert.equal(result.code, null);
  assert.ok(result.signal === 'SIGTERM' || result.signal === 'SIGKILL', `unexpected signal ${result.signal}`);
  assert.equal(activeChildCount(), 0);
});

test('killActiveChildren is a no-op when nothing is running', () => {
  assert.equal(killActiveChildren('SIGTERM'), 0);
});
