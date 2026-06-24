import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBatteryOutput, parseThermalOutput } from '../src/system.js';

test('parseThermalOutput reads legacy CPU_Scheduler_Limit form', () => {
  const parsed = parseThermalOutput('CPU_Scheduler_Limit = 100\nCPU_Available_CPUs = 100');
  assert.equal(parsed.available, true);
  assert.equal(parsed.schedulerLimit, 100);
  assert.equal(parsed.healthyIdle, undefined);
});

test('parseThermalOutput treats macOS 27 Note lines as healthy idle', () => {
  const macos27 = `Note: No thermal warning level has been recorded
Note: No performance warning level has been recorded
Note: No CPU power status has been recorded`;
  const parsed = parseThermalOutput(macos27);
  assert.equal(parsed.available, true);
  assert.equal(parsed.schedulerLimit, null);
  assert.equal(parsed.healthyIdle, true);
});

test('parseThermalOutput reports unavailable for empty output', () => {
  const parsed = parseThermalOutput('');
  assert.equal(parsed.available, false);
  assert.equal(parsed.schedulerLimit, null);
});

test('parseThermalOutput reports a throttled scheduler limit', () => {
  const parsed = parseThermalOutput('CPU_Scheduler_Limit = 40');
  assert.equal(parsed.schedulerLimit, 40);
});

test('parseBatteryOutput reads macOS 27 AC-on-separate-line form', () => {
  const macos27 = `Now drawing from 'AC Power'
 -InternalBattery-0 (id=23003235)\t80%; AC attached; not charging present: true`;
  const parsed = parseBatteryOutput(macos27);
  assert.equal(parsed.present, true);
  assert.equal(parsed.pct, 80);
  assert.equal(parsed.onAC, true);
});

test('parseBatteryOutput reads legacy discharging form', () => {
  const legacy = '-InternalBattery-0\t42%; discharging; present: true';
  const parsed = parseBatteryOutput(legacy);
  assert.equal(parsed.present, true);
  assert.equal(parsed.pct, 42);
  assert.equal(parsed.onAC, false);
});

test('parseBatteryOutput reads legacy "AC Power" charging form', () => {
  const legacy = "-InternalBattery-0\t100%; AC attached; charging present: true";
  const parsed = parseBatteryOutput(legacy);
  assert.equal(parsed.pct, 100);
  assert.equal(parsed.onAC, true);
});

test('parseBatteryOutput handles missing battery', () => {
  const parsed = parseBatteryOutput("Now drawing from 'AC Power'");
  assert.equal(parsed.present, false);
  assert.equal(parsed.pct, null);
  assert.equal(parsed.onAC, true);
});
