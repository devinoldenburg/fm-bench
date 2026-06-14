#!/usr/bin/env node
import { runCli } from '../src/cli.js';

runCli(process.argv.slice(2)).catch((error) => {
  const message = error?.message || String(error);
  console.error(`fm-bench: ${message}`);
  process.exitCode = typeof error?.exitCode === 'number' ? error.exitCode : 1;
});
