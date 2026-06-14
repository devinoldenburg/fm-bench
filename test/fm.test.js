import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAvailabilityOutput, parseModelsFromHelp } from '../src/fm.js';

test('parseModelsFromHelp extracts models from fm help', () => {
  const models = parseModelsFromHelp(`
  MODELS
    system        On-device Apple Foundation Model (default)
    pcc           Apple Foundation Model on Private Cloud Compute
  `);

  assert.deepEqual(models, [
    { name: 'system', description: 'On-device Apple Foundation Model' },
    { name: 'pcc', description: 'Apple Foundation Model on Private Cloud Compute' }
  ]);
});

test('parseModelsFromHelp also uses model option lists', () => {
  const models = parseModelsFromHelp('    -m, --model <model>     Model to use (system, pcc, future-model)');
  assert.deepEqual(models.map((model) => model.name), ['system', 'pcc', 'future-model']);
});

test('parseAvailabilityOutput treats explicit errors as unavailable', () => {
  const parsed = parseAvailabilityOutput('pcc', 'Error: PCC inference is not available in this context.', 0);
  assert.equal(parsed.available, false);
});

test('parseAvailabilityOutput detects available model line', () => {
  const parsed = parseAvailabilityOutput('system', 'System model available', 0);
  assert.equal(parsed.available, true);
});
