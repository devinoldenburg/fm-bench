import { runProcess } from './process.js';

// macOS releases that ship Apple's `fm` CLI. Older macOS versions cannot run
// fm-bench at all because the benchmarked binary does not exist there.
export const SUPPORTED_MACOS_MAJOR = 27;

export const MIN_SUPPORTED_MACOS = `${SUPPORTED_MACOS_MAJOR}.0`;

export const MACOS_REQUIREMENT_MESSAGE =
  `fm-bench requires macOS ${SUPPORTED_MACOS_MAJOR} or newer (Apple's fm CLI is preinstalled there).`;

export function parseMacosVersion(text = '') {
  const match = String(text).match(/ProductVersion:\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) return null;
  return {
    major: Number.parseInt(match[1], 10),
    minor: match[2] != null ? Number.parseInt(match[2], 10) : 0,
    patch: match[3] != null ? Number.parseInt(match[3], 10) : 0,
    version: [match[1], match[2], match[3]].filter((part) => part != null).join('.')
  };
}

export function isMacosSupported(parsed) {
  return parsed != null && Number.isInteger(parsed.major) && parsed.major >= SUPPORTED_MACOS_MAJOR;
}

export function evaluateMacosSupport(platform, parsed) {
  if (platform !== 'darwin') {
    return {
      supported: false,
      reason: `fm-bench only runs on macOS with Apple's fm CLI (detected platform: ${platform}).`,
      latestSupported: `macOS ${MIN_SUPPORTED_MACOS} or newer`
    };
  }
  if (parsed == null) {
    return {
      supported: true,
      warnOnly: true,
      reason: 'could not determine the macOS version',
      latestSupported: `macOS ${MIN_SUPPORTED_MACOS} or newer`
    };
  }
  if (isMacosSupported(parsed)) {
    return {
      supported: true,
      reason: null,
      latestSupported: `macOS ${MIN_SUPPORTED_MACOS} or newer`
    };
  }
  return {
    supported: false,
    reason: `detected macOS ${parsed.version}, but ${MACOS_REQUIREMENT_MESSAGE}`,
    latestSupported: `macOS ${MIN_SUPPORTED_MACOS} or newer`
  };
}

export function formatMacosRequirementError({ reason, latestSupported }) {
  return [
    `unsupported macOS: ${reason}`,
    `Latest supported: ${latestSupported} (fm is not available on older macOS releases).`
  ].join('\n');
}

export async function detectMacosVersion(options = {}) {
  const timeoutMs = options.timeoutMs ?? 5_000;
  if (typeof options.swVers === 'function') {
    return options.swVers();
  }
  const result = await runProcess('sw_vers', [], { timeoutMs });
  return result.stdout || result.stderr;
}
