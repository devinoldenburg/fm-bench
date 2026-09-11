#!/usr/bin/env node
// Deterministic fake `fm` used by the integration tests.
//
// It mimics the observable surface fm-bench depends on: `--help` (with a
// command list and a MODELS section), `respond --help`, `available`,
// `count-tokens`/`token-count`, and `respond` (streaming and not). Scenarios
// are selected with FAKE_FM_SCENARIO so the benchmark path can be driven
// through real, slow, malformed, failing, and interrupted behaviour without
// Apple's binary.
//
// Output shapes follow the real macOS 27 `fm` output captured in
// test/fixtures/fm-help-macos27.txt.

import process from 'node:process';
import { appendFileSync } from 'node:fs';

const args = process.argv.slice(2);
const scenario = process.env.FAKE_FM_SCENARIO || 'normal';
const command = args[0] && !args[0].startsWith('-') ? args[0] : null;

// Lets a test verify that fm-bench cleans up the fm processes it started.
if (process.env.FAKE_FM_PID_FILE) {
  appendFileSync(process.env.FAKE_FM_PID_FILE, `${process.pid}\n`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
  });
}

function tokenCountCommand() {
  if (scenario === 'no-token-count') return null;
  if (scenario === 'legacy-token-count') return 'token-count';
  return 'count-tokens';
}

function hasQuota() {
  return scenario === 'quota';
}

function models() {
  if (scenario === 'multi-model') {
    return [
      { name: 'system', description: 'On-device Apple Foundation Model', available: true },
      { name: 'pcc', description: 'Apple Foundation Model on Private Cloud Compute', available: false }
    ];
  }
  return [{ name: 'system', description: 'On-device Apple Foundation Model', available: true }];
}

function helpText() {
  if (scenario === 'help-garbage') return 'not a cli\n';
  if (scenario === 'error-help') {
    process.stderr.write("Error: Unknown command 'reply'.\n");
    process.exit(1);
  }
  const commands = [
    ['available', 'Check model availability'],
    ['chat', 'Start an interactive chat session']
  ];
  const counter = tokenCountCommand();
  if (counter) commands.push([counter, 'Count tokens in a prompt or instructions']);
  if (hasQuota()) commands.push(['quota-usage', 'Show quota usage']);
  commands.push(
    ['license', 'Show and agree to the Legal Notice & Terms'],
    ['respond', 'Generate a response to a prompt'],
    ['schema', 'Generate a structured output generation schema'],
    ['serve', 'Start a Chat Completions API server']
  );

  const commandLines = commands
    .map(([name, description]) => `    ${name.padEnd(14)}${description}`)
    .join('\n');
  const modelLines = models()
    .map((model) => `    ${model.name.padEnd(14)}${model.description}${model.name === 'system' ? ' (default)' : ''}`)
    .join('\n');

  return `\n Apple Foundation Models CLI\n\n  USAGE\n    % fm <command> [options]\n\n  COMMANDS\n${commandLines}\n\n  MODELS\n${modelLines}\n\n  Run 'fm <command> --help' for more information on a command.\n\n`;
}

function respondHelpText() {
  const modelFlag = scenario === 'no-model-flag'
    ? ''
    : '    -m, --model <model>     Model to use (system)\n';
  const streamFlag = scenario === 'no-streaming'
    ? ''
    : "    --[no-]stream           Stream the output as it's generated (default: on)\n";
  return `
  fm respond
  Generate a response to a prompt.

  USAGE
    % fm respond 'What is Swift?'

  ARGUMENTS
    <prompt>                Prompt for the model to respond to

  OPTIONS
${modelFlag}    -i, --instructions <t>  Instructions for the model to follow
${streamFlag}    -g, --greedy            Use greedy sampling
    -v, --verbose           Print verbose output
    -h, --help              Show help information

  MODELS
    system                  On-device Apple Foundation Model (default)
`;
}

async function runRespond() {
  const streamed = !args.includes('--no-stream') && scenario !== 'no-streaming';
  const prompt = await readStdin();

  if (scenario === 'fail') {
    process.stderr.write('Error: The model failed to produce a response.\n');
    process.exit(3);
  }
  if (scenario === 'unavailable-model') {
    process.stderr.write("Error: The value 'system' is invalid for '--model <model>'. Please provide one of 'none'.\n");
    process.exit(64);
  }
  if (scenario === 'malformed') {
    // Invalid UTF-8 plus stray control bytes: fm-bench must not crash on it.
    process.stdout.write(Buffer.from([0xff, 0xfe, 0x80]));
    process.stdout.write('replacement bytes \u0007\n');
    process.exit(0);
  }
  if (scenario === 'timeout' || scenario === 'interrupt') {
    await sleep(600_000);
    process.exit(0);
  }

  const chunks = scenario === 'short-answer'
    ? ['ok', '\n']
    : streamed
      ? ['The on-device model ', 'replies ', 'with a ', 'deterministic ', 'answer.']
      : [`The on-device model replies with a deterministic answer for "${prompt.trim()}".`];
  const delayMs = scenario === 'slow' ? 400 : 20;

  for (const [index, chunk] of chunks.entries()) {
    if (index > 0) await sleep(delayMs);
    process.stdout.write(chunk);
    if (scenario === 'partial' && index === 1) {
      process.stderr.write('Error: stream interrupted\n');
      process.exit(1);
    }
  }
  process.stdout.write(scenario === 'short-answer' ? '' : '\n');
  process.exit(0);
}

async function main() {
  if (args.includes('--help') && !command) {
    process.stdout.write(helpText());
    process.exit(0);
  }
  if (command === 'respond' && args.includes('--help')) {
    process.stdout.write(respondHelpText());
    process.exit(0);
  }
  if (command === 'available' && args.includes('--help')) {
    process.stdout.write('\n  fm available\n  Check model availability.\n\n  USAGE\n    % fm available\n\n  OPTIONS\n    -m, --model <model>  Model to check (system); checks all if omitted\n');
    process.exit(0);
  }

  if (command === 'available') {
    if (scenario === 'unavailable') {
      process.stderr.write('Error: The system model is unavailable in this context.\n');
      process.exit(1);
    }
    const modelIndex = args.indexOf('--model');
    const requested = modelIndex >= 0 ? args[modelIndex + 1] : null;
    if (requested) {
      const model = models().find((entry) => entry.name === requested);
      if (!model) {
        process.stderr.write(`Error: The value '${requested}' is invalid for '--model <model>'. Please provide one of '${models().map((entry) => entry.name).join("', '")}'.\n`);
        process.exit(64);
      }
      process.stdout.write(`${requested === 'system' ? 'System' : requested} model ${model.available ? 'available' : 'unavailable'}\n`);
      process.exit(model.available ? 0 : 1);
    }
    for (const model of models()) {
      process.stdout.write(`${model.name.charAt(0).toUpperCase()}${model.name.slice(1)} model ${model.available ? 'available' : 'unavailable'}\n`);
    }
    process.exit(0);
  }

  const counter = tokenCountCommand();
  if (command === counter) {
    if (scenario === 'token-count-fails') {
      process.stderr.write("Error: The value 'system' is invalid for '--model <model>'.\n");
      process.exit(64);
    }
    const text = await readStdin();
    const quiet = args.includes('--quiet');
    const count = text.trim() ? text.trim().split(/\s+/).length : 0;
    process.stdout.write(quiet || !process.stdout.isTTY ? `${count}\n` : `Token count: ${count}\n`);
    process.exit(0);
  }

  if (command === 'quota-usage') {
    process.stdout.write('Quota: 1000 requests remaining\n');
    process.exit(0);
  }

  if (command === 'respond') {
    await runRespond();
    return;
  }

  process.stderr.write(`Error: Unknown command '${command}'.\nRun 'fm --help' for the list of commands.\n`);
  process.exit(1);
}

await main();
