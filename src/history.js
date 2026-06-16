import fs from 'node:fs/promises';
import path from 'node:path';
import { formatMs, formatNumber, formatPercent } from './table.js';

export async function loadHistory(dir) {
  const absDir = path.resolve(dir);
  let entries;
  try {
    entries = await fs.readdir(absDir);
  } catch {
    throw new Error(`Cannot read directory: ${absDir}`);
  }

  const jsonFiles = entries
    .filter((name) => name.endsWith('.json'))
    .map((name) => path.join(absDir, name))
    .sort();

  const reports = [];
  for (const filePath of jsonFiles) {
    try {
      const text = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(text);
      if (parsed.tool === 'fm-bench' && parsed.summary) {
        reports.push({ filePath, report: parsed });
      }
    } catch {
      // skip unparseable files
    }
  }

  return reports;
}

export function renderHistoryReport(reports, options = {}) {
  if (reports.length === 0) {
    return 'No fm-bench JSON reports found in the given directory.';
  }

  const { color = false, ascii = false } = options;
  const V = ascii ? '|' : '│';
  const H = ascii ? '-' : '─';
  const TL = ascii ? '+' : '┌';
  const TR = ascii ? '+' : '┐';
  const BL = ascii ? '+' : '└';
  const BR = ascii ? '+' : '┘';
  const ML = ascii ? '+' : '├';
  const MR = ascii ? '+' : '┤';
  const TJ = ascii ? '+' : '┬';
  const MJ = ascii ? '+' : '┼';
  const BJ = ascii ? '+' : '┴';

  const colWidths = [19, 8, 3, 6, 9, 9, 9, 9, 5];
  const headers = ['STARTED AT', 'MODEL', 'C', 'RUNS', 'TTFT P50', 'E2E P50', 'E2E P95', 'USER T/S', 'SUCC'];

  const renderRule = (l, j, r) => `${l}${colWidths.map((w) => H.repeat(w + 2)).join(j)}${r}`;
  const renderRowLine = (cells) => `${V}${cells.map((text, i) => ` ${fit(text, colWidths[i])} `).join(V)}${V}`;

  const lines = [];
  lines.push(`fm-bench history (${reports.length} report${reports.length === 1 ? '' : 's'})`);
  lines.push('');
  lines.push(renderRule(TL, TJ, TR));
  lines.push(renderRowLine(headers.map((h, i) => h)));
  lines.push(renderRule(ML, MJ, MR));

  for (const { filePath, report } of reports) {
    const started = report.startedAt ? report.startedAt.slice(0, 19).replace('T', ' ') : '?';
    const modelRows = report.summary ?? [];

    for (const item of modelRows) {
      if (!item.available) continue;
      const row = [
        started,
        item.model ?? '-',
        String(item.concurrency ?? 1),
        String(item.successes ?? '-'),
        item.ttft?.p50 != null ? formatMs(item.ttft.p50) : '-',
        item.latency?.p50 != null ? formatMs(item.latency.p50) : '-',
        item.latency?.p95 != null ? formatMs(item.latency.p95) : '-',
        item.tokensPerSecond?.avg != null ? formatNumber(item.tokensPerSecond.avg) : '-',
        item.successRate != null ? formatPercent(item.successRate) : '-'
      ];
      lines.push(renderRowLine(row));
    }
  }

  lines.push(renderRule(BL, BJ, BR));
  return lines.join('\n');
}

function fit(text, width) {
  const str = String(text ?? '');
  if (str.length <= width) return str + ' '.repeat(width - str.length);
  return `${str.slice(0, width - 1)}…`;
}
