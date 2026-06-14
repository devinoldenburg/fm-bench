import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../src/cli.js';

test('parseArgs supports repeated models and prompts', () => {
  const args = parseArgs(['--models', 'system,pcc', '--model', 'future', '--prompt', 'one', '--prompt', 'two']);
  assert.deepEqual(args.models, ['system,pcc', 'future']);
  assert.deepEqual(args.prompts, ['one', 'two']);
});

test('parseArgs defaults to run command and table output', () => {
  const args = parseArgs([]);
  assert.equal(args.command, 'run');
  assert.equal(args.format, 'table');
  assert.equal(args.runs, 1);
  assert.equal(args.stream, true);
  assert.equal(args.ascii, false);
});

test('parseArgs supports terminal rendering and stream flags', () => {
  const args = parseArgs(['--ascii', '--compact', '--width', '72', '--no-stream']);
  assert.equal(args.ascii, true);
  assert.equal(args.compact, true);
  assert.equal(args.width, 72);
  assert.equal(args.stream, false);
});

test('parseArgs supports concurrency sweeps', () => {
  const args = parseArgs(['--sweep-concurrency', '1,2,4']);
  assert.deepEqual(args.sweepConcurrency, [1, 2, 4]);
  assert.equal(args.concurrency, 1);
});
