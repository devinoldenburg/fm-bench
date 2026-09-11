#!/usr/bin/env node
import { runCli } from '../src/cli.js';
import { killActiveChildren } from '../src/process.js';

// Terminate any in-flight `fm` child process before exiting, then use the
// conventional 128 + signal exit code. A second signal exits immediately.
let signalsReceived = 0;
let interrupted = false;
for (const [signal, exitCode] of [['SIGINT', 130], ['SIGTERM', 143]]) {
  process.on(signal, () => {
    signalsReceived += 1;
    interrupted = true;
    // Carry the status on the process too, so the code survives even if the
    // exit below is preempted.
    process.exitCode = exitCode;
    const killed = killActiveChildren(signal);
    if (signalsReceived > 1 || killed === 0) process.exit(exitCode);
    // Deliberately not unref'd: this timer performs the exit after giving the
    // killed children a moment to be reaped.
    setTimeout(() => process.exit(exitCode), 500);
  });
}

runCli(process.argv.slice(2)).catch((error) => {
  if (interrupted) {
    // The user asked to stop; a follow-up benchmark error is noise.
    process.exitCode = typeof error?.exitCode === 'number' ? error.exitCode : 1;
    return;
  }
  const message = error?.message || String(error);
  console.error(`fm-bench: ${message}`);
  process.exitCode = typeof error?.exitCode === 'number' ? error.exitCode : 1;
});
