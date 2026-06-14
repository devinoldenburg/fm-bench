const ANSI_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/g;

export function stripAnsi(value) {
  return String(value ?? '').replace(ANSI_PATTERN, '');
}
