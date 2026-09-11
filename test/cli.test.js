import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, runCli } from '../src/cli.js';
import { fakeFmPath } from './helpers.js';

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
    () => runCli(['--profile', 'quick'], { platform: 'darwin', swVers: swVers26, FM_BIN: '' }),
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
    () => runCli(['models'], { platform: 'darwin', swVers: swVers26, FM_BIN: '' }),
    (error) => {
      assert.equal(error.exitCode, 2);
      assert.match(error.message, /Latest supported/);
      return true;
    }
  );
});

test('runCli blocks benchmarks on non-macOS platforms', async () => {
  await assert.rejects(
    () => runCli(['--profile', 'quick'], { platform: 'linux', swVers: swVers26, FM_BIN: '' }),
    (error) => {
      assert.match(error.message, /only runs on macOS/);
      assert.equal(error.exitCode, 2);
      return true;
    }
  );
});

test('runCli keeps offline commands usable on unsupported macOS', async () => {
  await assert.doesNotReject(() => runCli(['legend', '--json'], { platform: 'darwin', swVers: swVers26, FM_BIN: '' }));
});

test('parseArgs reports usage errors with exit code 2', () => {
  for (const argv of [['--not-a-flag'], ['--profile', 'nope'], ['--runs', '0'], ['--width'], ['--format', 'yaml']]) {
    assert.throws(
      () => parseArgs(argv),
      (error) => {
        assert.equal(error.exitCode, 2, `expected exit code 2 for ${argv.join(' ')}`);
        return true;
      }
    );
  }
});

test('parseArgs accepts the documented model and prompt flags', () => {
  const args = parseArgs(['--models', 'system', '--runs', '3', '--warmup', '1', '--timeout-ms', '5000', '--retry', '2']);
  assert.deepEqual(args.models, ['system']);
  assert.equal(args.runs, 3);
  assert.equal(args.warmup, 1);
  assert.equal(args.timeoutMs, 5000);
  assert.equal(args.retry, 2);
});

test('--version prints only the package version', async () => {
  const original = console.log;
  const lines = [];
  console.log = (line) => lines.push(line);
  try {
    await runCli(['--version'], { platform: 'darwin' });
  } finally {
    console.log = original;
  }
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^\d+\.\d+\.\d+$/);
});

test('--help documents exit codes and capability detection', async () => {
  const original = console.log;
  const lines = [];
  console.log = (line) => lines.push(line);
  try {
    await runCli(['--help'], { platform: 'darwin' });
  } finally {
    console.log = original;
  }
  const text = lines.join('\n');
  assert.match(text, /Exit codes:/);
  assert.match(text, /usage or environment error/);
  assert.match(text, /Capability detection:/);
  assert.match(text, /unavailable instead of being/);
  assert.match(text, /Alias for legend/);
});

test('legend --json is usable with no fm and no network', async () => {
  const original = console.log;
  const lines = [];
  console.log = (line) => lines.push(line);
  try {
    await runCli(['legend', '--json'], { platform: 'darwin' });
  } finally {
    console.log = original;
  }
  const entries = JSON.parse(lines.join('\n'));
  assert.ok(entries.length > 10);
  assert.ok(entries.every((entry) => typeof entry.kind === 'string'));
});

test('an explicitly configured fm binary bypasses the macOS version gate', async () => {
  // The fake fm stands in for a user-provided binary on a host too old for the
  // preinstalled CLI, which is why the gate only guards the default path.
  const original = console.log;
  console.log = () => {};
  try {
    await assert.doesNotReject(() => runCli(
      ['--profile', 'quick', '--runs', '1', '--no-progress', '--fm-bin', fakeFmPath(), '--json'],
      { platform: 'darwin', swVers: swVers26, FM_BIN: '' }
    ));
    await assert.doesNotReject(() => runCli(
      ['models', '--fm-bin', fakeFmPath()],
      { platform: 'darwin', swVers: swVers26, FM_BIN: '' }
    ));
  } finally {
    console.log = original;
  }
});

test('the macOS gate still applies to the default fm path', async () => {
  await assert.rejects(
    () => runCli(['--profile', 'quick'], { platform: 'darwin', swVers: swVers26, FM_BIN: '' }),
    (error) => {
      assert.equal(error.exitCode, 2);
      assert.match(error.message, /Pass --fm-bin/);
      return true;
    }
  );
});
