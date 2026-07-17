import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, runCli } from '../src/cli.js';

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

test('parseArgs supports legend command and metrics alias', () => {
  assert.equal(parseArgs(['legend']).command, 'legend');
  assert.equal(parseArgs(['metrics']).command, 'legend');
});

test('parseArgs supports terminal rendering and stream flags', () => {
  const args = parseArgs(['--ascii', '--color', '--progress', '--compact', '--width', '72', '--no-stream']);
  assert.equal(args.ascii, true);
  assert.equal(args.color, 'always');
  assert.equal(args.progress, 'always');
  assert.equal(args.compact, true);
  assert.equal(args.width, 72);
  assert.equal(args.stream, false);
});

test('parseArgs supports disabling colors', () => {
  const args = parseArgs(['--no-color']);
  assert.equal(args.color, 'never');
});

test('parseArgs supports concurrency sweeps', () => {
  const args = parseArgs(['--sweep-concurrency', '1,2,4', '--request-rate', '0.5', '--ramp-up-ms', '1000']);
  assert.deepEqual(args.sweepConcurrency, [1, 2, 4]);
  assert.equal(args.concurrency, 1);
  assert.equal(args.requestRate, 0.5);
  assert.equal(args.rampUpMs, 1000);
});

test('parseArgs supports disabling progress', () => {
  const args = parseArgs(['--no-progress']);
  assert.equal(args.progress, 'never');
});

test('parseArgs supports validate export compare strict and export-html', () => {
  assert.equal(parseArgs(['validate', 'a.json']).command, 'validate');
  assert.deepEqual(parseArgs(['validate', 'a.json']).validateFiles, ['a.json']);
  assert.equal(parseArgs(['export', 'a.json']).command, 'export');
  const run = parseArgs(['--export-html', '--strict']);
  assert.equal(run.exportHtml, true);
  assert.equal(run.strictCompare, true);
});

const SW_VERS_26 = 'ProductName:\tmacOS\nProductVersion:\t26.1\nBuildVersion:\t25B78\n';
const swVers26 = async () => SW_VERS_26;

test('runCli blocks benchmarks on macOS older than 27 and names the latest supported version', async () => {
  await assert.rejects(
    () => runCli(['--profile', 'quick'], { platform: 'darwin', swVers: swVers26 }),
    (error) => {
      assert.match(error.message, /unsupported macOS/);
      assert.match(error.message, /detected macOS 26\.1/);
      assert.match(error.message, /Latest supported: macOS 27\.0 or newer/);
      assert.equal(error.exitCode, 2);
      return true;
    }
  );
});

test('runCli blocks models on unsupported macOS', async () => {
  await assert.rejects(
    () => runCli(['models'], { platform: 'darwin', swVers: swVers26 }),
    (error) => {
      assert.equal(error.exitCode, 2);
      assert.match(error.message, /Latest supported/);
      return true;
    }
  );
});

test('runCli blocks benchmarks on non-macOS platforms', async () => {
  await assert.rejects(
    () => runCli(['--profile', 'quick'], { platform: 'linux', swVers: swVers26 }),
    (error) => {
      assert.match(error.message, /only runs on macOS/);
      assert.equal(error.exitCode, 2);
      return true;
    }
  );
});

test('runCli keeps offline commands usable on unsupported macOS', async () => {
  await assert.doesNotReject(() => runCli(['legend', '--json'], { platform: 'darwin', swVers: swVers26 }));
});
