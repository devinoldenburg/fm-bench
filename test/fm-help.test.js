import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  firstLine,
  isUnsupportedModelError,
  parseAvailabilityList,
  parseAvailabilityOutput,
  parseModelsFromHelp
} from '../src/fm-help.js';
import { fixturePath } from './helpers.js';

const realHelp = readFileSync(fixturePath('fm-help-macos27.txt'), 'utf8');
const realAvailable = readFileSync(fixturePath('fm-available-macos27.txt'), 'utf8');

test('parseAvailabilityList reads the captured fm available output', () => {
  assert.deepEqual(parseAvailabilityList(realAvailable), [{ name: 'system', available: true }]);
});

test('parseAvailabilityList reads multiple models and unavailable states', () => {
  const parsed = parseAvailabilityList(`
System model available
PCC model unavailable
`);
  assert.deepEqual(parsed, [
    { name: 'system', available: true },
    { name: 'pcc', available: false }
  ]);
});

test('parseAvailabilityList ignores unrelated lines', () => {
  assert.deepEqual(parseAvailabilityList('Checking models...\n'), []);
});

test('parseAvailabilityOutput requires a clean exit and an availability statement', () => {
  assert.equal(parseAvailabilityOutput('system', 'System model available\n', 0).available, true);
  assert.equal(parseAvailabilityOutput('system', 'System model available\n', 1).available, false);
  assert.equal(parseAvailabilityOutput('system', '', 0).available, false);
});

test('parseAvailabilityOutput treats fm argument errors as unavailable', () => {
  const realError = "Error: The value 'pcc' is invalid for '--model <model>'. Please provide one of 'system'.\nHelp:  --model <model>  Model to check: system (default: all)\nUsage: fm available\n";
  const parsed = parseAvailabilityOutput('pcc', realError, 64);
  assert.equal(parsed.available, false);
  assert.match(parsed.reason, /invalid for '--model <model>'/);
  assert.doesNotMatch(parsed.reason, /Usage:|\n/);
});

test('parseAvailabilityOutput flags explicit unavailability', () => {
  const parsed = parseAvailabilityOutput('pcc', 'Error: PCC inference is not available in this context.', 0);
  assert.equal(parsed.available, false);
  assert.match(parsed.reason, /not available/);
});

test('isUnsupportedModelError distinguishes unsupported from unusable', () => {
  assert.equal(isUnsupportedModelError("Error: The value 'pcc' is invalid for '--model <model>'."), true);
  assert.equal(isUnsupportedModelError('Error: The model is unavailable right now.'), false);
});

test('firstLine collapses multi-line fm diagnostics to the actionable cause', () => {
  const text = "Error: The value 'pcc' is invalid for '--model <model>'.\nHelp:  --model <model>\nUsage: fm available\n";
  assert.equal(firstLine(text), "The value 'pcc' is invalid for '--model <model>'.");
  assert.equal(firstLine(''), '');
  assert.equal(firstLine('\u001b[31mplain message\u001b[0m'), 'plain message');
});

test('parseModelsFromHelp reads models and option lists together', () => {
  const models = parseModelsFromHelp(`
  OPTIONS
    -m, --model <model>     Model to use (system, pcc)

  MODELS
    system                  On-device Apple Foundation Model (default)
`);
  assert.deepEqual(models.map((model) => model.name), ['system', 'pcc']);
  assert.equal(models[0].description, 'On-device Apple Foundation Model');
});

test('parseModelsFromHelp does not mistake section headers for models', () => {
  assert.deepEqual(parseModelsFromHelp(realHelp).map((model) => model.name), ['system']);
});
