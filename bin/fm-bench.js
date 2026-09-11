#!/usr/bin/env node
import { runCli } from '../src/cli.js';
import { killActiveChildren } from '../src/process.js';

// Terminate any in-flight `fm` child process before exiting, then use the
// conventional 128 + signal exit code. A second signal exits immediately.
let interrupting = false;
for (const [signal, exitCode] of [['SIGINT', 130], ['SIGTERM', 143]]) {
  process.on(signal, () => {
    const killed = killActiveChildren(signal);
    if (interrupting) process.exit(exitCode);
    interrupting = true;
    const graceMs = killed > 0 ? 500 : 0;
    setTimeout(() => process.exit(exitCode), graceMs).unref();
  });
}

runCli(process.argv.slice(2)).catch((error) => {
  const message = error?.message || String(error);
  console.error(`fm-bench: ${message}`);
  process.exitCode = typeof error?.exitCode === 'number' ? error.exitCode : 1;
});
