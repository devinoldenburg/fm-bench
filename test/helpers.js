import { chmodSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(fixtureDir, '..');

/**
 * Absolute path to the deterministic fake `fm` executable.
 *
 * The exec bit is re-applied on every use so the integration tests do not
 * depend on the bit surviving a checkout.
 */
export function fakeFmPath() {
  const path = join(fixtureDir, 'fixtures/fake-fm.mjs');
  chmodSync(path, 0o755);
  return path;
}

export function fixturePath(name) {
  return join(fixtureDir, 'fixtures', name);
}

export function cliPath() {
  return join(repoRoot, 'bin', 'fm-bench.js');
}

/**
 * Run the real CLI entry point the way a user would.
 * @param {string[]} args
 * @param {{ env?: Record<string, string>, cwd?: string, timeoutMs?: number }} [options]
 */
export function runCli(args, options = {}) {
  const result = spawnSync(process.execPath, [cliPath(), ...args], {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    encoding: 'utf8',
    timeout: options.timeoutMs ?? 60_000
  });
  return {
    code: result.status,
    signal: result.signal,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? ''
  };
}

/** Run the real CLI against the fake fm for a given scenario. */
export function runCliWithFakeFm(args, scenario = 'normal', options = {}) {
  return runCli(args, {
    ...options,
    env: { FM_BIN: fakeFmPath(), FAKE_FM_SCENARIO: scenario, ...options.env }
  });
}
