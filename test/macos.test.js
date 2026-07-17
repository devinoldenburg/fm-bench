import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMacosSupport, formatMacosRequirementError, isMacosSupported, MIN_SUPPORTED_MACOS, parseMacosVersion, SUPPORTED_MACOS_MAJOR } from '../src/macos.js';

const SW_VERS_27 = 'ProductName:\t\tmacOS\nProductVersion:\t\t27.0\nBuildVersion:\t\t26A5378n\n';
const SW_VERS_26 = 'ProductName:\t\tmacOS\nProductVersion:\t\t26.1\nBuildVersion:\t\t25B78\n';

test('parseMacosVersion reads sw_vers output', () => {
  assert.deepEqual(parseMacosVersion(SW_VERS_27), { major: 27, minor: 0, patch: 0, version: '27.0' });
  assert.deepEqual(parseMacosVersion(SW_VERS_26), { major: 26, minor: 1, patch: 0, version: '26.1' });
});

test('parseMacosVersion reads bare version strings and two-part versions', () => {
  assert.deepEqual(parseMacosVersion('ProductVersion: 27'), { major: 27, minor: 0, patch: 0, version: '27' });
  assert.deepEqual(parseMacosVersion('ProductVersion: 27.1.2'), { major: 27, minor: 1, patch: 2, version: '27.1.2' });
});

test('parseMacosVersion returns null for unknown output', () => {
  assert.equal(parseMacosVersion(''), null);
  assert.equal(parseMacosVersion('hello world'), null);
  assert.equal(parseMacosVersion(null), null);
});

test('isMacosSupported accepts macOS 27 and newer only', () => {
  assert.equal(isMacosSupported(parseMacosVersion(SW_VERS_27)), true);
  assert.equal(isMacosSupported(parseMacosVersion('ProductVersion: 28.0')), true);
  assert.equal(isMacosSupported(parseMacosVersion(SW_VERS_26)), false);
  assert.equal(isMacosSupported(parseMacosVersion('ProductVersion: 15.5')), false);
  assert.equal(isMacosSupported(null), false);
});

test('evaluateMacosSupport rejects older macOS with latest supported version', () => {
  const result = evaluateMacosSupport('darwin', parseMacosVersion(SW_VERS_26));
  assert.equal(result.supported, false);
  assert.match(result.reason, /macOS 26\.1/);
  assert.match(result.reason, /macOS 27 or newer/);
  assert.equal(result.latestSupported, `macOS ${MIN_SUPPORTED_MACOS} or newer`);
});

test('evaluateMacosSupport accepts macOS 27+', () => {
  assert.equal(evaluateMacosSupport('darwin', parseMacosVersion(SW_VERS_27)).supported, true);
  assert.equal(evaluateMacosSupport('darwin', parseMacosVersion('ProductVersion: 29.0')).supported, true);
});

test('evaluateMacosSupport rejects non-macOS platforms', () => {
  const result = evaluateMacosSupport('linux', null);
  assert.equal(result.supported, false);
  assert.match(result.reason, /linux/);
});

test('evaluateMacosSupport warns but does not block unknown versions', () => {
  const result = evaluateMacosSupport('darwin', null);
  assert.equal(result.supported, true);
  assert.equal(result.warnOnly, true);
});

test('formatMacosRequirementError names the latest supported macOS', () => {
  const evaluation = evaluateMacosSupport('darwin', parseMacosVersion(SW_VERS_26));
  const message = formatMacosRequirementError(evaluation);
  assert.match(message, /unsupported macOS/);
  assert.match(message, /Latest supported: macOS 27\.0 or newer/);
});

test('supported major is 27', () => {
  assert.equal(SUPPORTED_MACOS_MAJOR, 27);
  assert.equal(MIN_SUPPORTED_MACOS, '27.0');
});
