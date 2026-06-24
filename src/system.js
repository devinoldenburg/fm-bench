// Parsers for macOS system probes used by `fm-bench doctor`.
//
// macOS 27 changed the text emitted by `pmset -g therm` and `pmset -g batt`.
// These helpers accept the raw stdout/stderr of those commands and return
// structured values so the doctor command and its tests are not coupled to
// the exact wording of any one macOS release.

export function parseThermalOutput(output = '') {
  const text = String(output).trim();
  if (!text) {
    return { available: false, schedulerLimit: null, raw: '' };
  }

  const limitMatch = text.match(/CPU_Scheduler_Limit\s*=\s*(-?\d+)/);
  if (limitMatch) {
    const schedulerLimit = Number.parseInt(limitMatch[1], 10);
    return {
      available: true,
      schedulerLimit,
      raw: text
    };
  }

  // macOS 27 (and recent releases) prints these informational "Note:" lines
  // when the system is NOT under thermal pressure. Treat that as a healthy,
  // explicitly-reported state rather than silently dropping the check.
  const hasNote = /^Note:/m.test(text);
  if (hasNote) {
    return {
      available: true,
      schedulerLimit: null,
      raw: text,
      healthyIdle: true
    };
  }

  return { available: false, schedulerLimit: null, raw: text };
}

export function parseBatteryOutput(output = '') {
  const text = String(output).trim();
  if (!text) {
    return { present: false, pct: null, onAC: false, raw: '' };
  }

  const lines = text.split(/\r?\n/);
  const batteryLine = lines.find((line) => line.includes('%')) || '';
  const pctMatch = batteryLine.match(/(\d+)%/);
  const pct = pctMatch ? Number.parseInt(pctMatch[1], 10) : null;

  // macOS 27 writes "Now drawing from 'AC Power'" on its own line and
  // "AC attached" on the battery line. Older releases used "AC Power" in
  // the battery line itself. Accept either form.
  const onAC = /AC Power|AC attached|AC attached;/i.test(text)
    || /;\s*charging\b/i.test(batteryLine);

  const present = /InternalBattery|present:\s*true/i.test(text);

  return {
    present: present || pct != null,
    pct,
    onAC,
    raw: text
  };
}
