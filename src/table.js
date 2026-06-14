export function renderTable(headers, rows, options = {}) {
  const ascii = Boolean(options.ascii);
  const maxCellWidth = options.maxCellWidth || 60;
  const stringRows = rows.map((row) => row.map((cell) => truncate(formatCell(cell), maxCellWidth)));
  const widths = headers.map((header, index) => {
    const values = [truncate(header, maxCellWidth), ...stringRows.map((row) => row[index] ?? '')];
    return Math.max(...values.map(visibleLength));
  });
  const style = ascii ? ASCII_TABLE : UNICODE_TABLE;

  const top = rule(style.topLeft, style.topJoin, style.topRight, style.horizontal, widths);
  const middle = rule(style.midLeft, style.midJoin, style.midRight, style.horizontal, widths);
  const bottom = rule(style.bottomLeft, style.bottomJoin, style.bottomRight, style.horizontal, widths);
  const headerLine = rowLine(headers.map((header) => truncate(header, maxCellWidth)), widths, style, true);
  const bodyLines = stringRows.map((row) => rowLine(row, widths, style));

  return [top, headerLine, middle, ...bodyLines, bottom].join('\n');
}

export function renderBenchmarkReport(payload, options = {}) {
  const width = terminalWidth(options);
  const mode = options.compact || width < 88
    ? 'compact'
    : width < 140
      ? 'medium'
      : 'wide';
  const lines = [];
  const elapsedMs = Date.parse(payload.finishedAt) - Date.parse(payload.startedAt);
  const skipped = payload.summary.filter((item) => !item.available).length;
  const measured = payload.summary.reduce((sum, item) => sum + item.successes, 0);
  const failed = payload.summary.reduce((sum, item) => sum + item.failures, 0);
  const concurrencies = payload.options.sweepConcurrency?.length
    ? payload.options.sweepConcurrency.join(',')
    : String(payload.options.concurrency);
  const slo = formatSlo(payload.options.slo);

  const title = `fm-bench ${payload.version} | ${payload.environment.platform}/${payload.environment.arch} | ${payload.environment.fmBin}`;
  const meta = `prompts ${payload.prompts.length} | runs ${payload.options.runs} | concurrency ${concurrencies} | stream ${payload.options.stream ? 'on' : 'off'} | measured ${measured} | failed ${failed} | skipped ${skipped} | elapsed ${formatMs(elapsedMs)}${slo ? ` | ${slo}` : ''}`;
  lines.push(truncate(title, width));
  lines.push(truncate(meta, width));
  lines.push('');

  if (mode === 'compact') {
    lines.push(renderCompactSummary(payload.summary, { ...options, width }));
  } else {
    lines.push(renderSummaryTable(payload.summary, { ...options, mode, width }));
    lines.push('');
    lines.push(renderDetailTable(payload.summary, { ...options, mode, width }));
  }

  lines.push('');
  lines.push(compactLegend(width));

  return lines.join('\n');
}

export function formatMs(value) {
  if (value == null || !Number.isFinite(value)) return '-';
  if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
  return `${Math.round(value)}ms`;
}

export function formatNumber(value, digits = 1) {
  if (value == null || !Number.isFinite(value)) return '-';
  if (Math.abs(value) >= 100) return Math.round(value).toLocaleString('en-US');
  return value.toFixed(digits);
}

export function formatPercent(value, digits = 0) {
  if (value == null || !Number.isFinite(value)) return '-';
  return `${(value * 100).toFixed(digits)}%`;
}

export function renderSummaryTable(summary, options = {}) {
  const mode = options.mode || 'wide';
  const hasGoodput = summary.some((item) => item.goodputRate != null);
  const rows = summary.map((item) => {
    const status = item.available ? (item.failures > 0 ? 'partial' : 'ok') : 'skipped';
    const base = [
      formatConcurrency(item.concurrency),
      item.model,
      status,
      item.attempted ? `${item.successes}/${item.attempted}` : '-',
      formatPercent(item.successRate),
      formatPercent(item.goodputRate),
      formatMs(item.ttft.p50),
      formatMs(item.ttft.p95),
      formatMs(item.latency.p50),
      formatMs(item.latency.p95),
      formatNumber(item.tokensPerSecond.avg),
      formatNumber(item.outputTokenThroughput),
      formatNumber(item.rps),
      formatPercent(item.latency.cv),
      item.available ? '' : compactReason(item.skippedReason)
    ];

    if (mode === 'medium') {
      const medium = [
        base[0],
        base[1],
        base[2],
        base[3]
      ];
      if (hasGoodput) medium.push(base[5]);
      medium.push(base[6], base[8], base[9], base[10], base[11], base[13], base[14]);
      return medium;
    }

    const wide = [base[0], base[1], base[2], base[3], base[4]];
    if (hasGoodput) wide.push(base[5]);
    wide.push(
      base[6],
      base[7],
      base[8],
      base[9],
      formatMs(item.tpot.p50),
      formatMs(item.tpot.p95),
      base[10],
      base[11],
      base[12],
      base[13],
      base[14]
    );
    return wide;
  });

  const mediumHeaders = ['c', 'model', 'status', 'ok', 'good', 'ttft', 'e2e', 'e2e p95', 'user/s', 'sys/s', 'cv', 'note'];
  const wideHeaders = ['c', 'model', 'status', 'ok/runs', 'succ', 'good', 'ttft', 'ttft p95', 'e2e', 'e2e p95', 'tpot', 'tpot p95', 'user t/s', 'sys t/s', 'rps', 'cv', 'note'];
  const headers = mode === 'medium'
    ? (hasGoodput ? mediumHeaders : mediumHeaders.filter((header) => header !== 'good'))
    : (hasGoodput ? wideHeaders : wideHeaders.filter((header) => header !== 'good'));

  return renderTable(headers, rows, { ...options, maxCellWidth: mode === 'medium' ? 24 : 52 });
}

export function renderDetailTable(summary, options = {}) {
  const mode = options.mode || 'wide';
  const rows = summary.map((item) => {
    const base = [
      formatConcurrency(item.concurrency),
      item.model,
      formatNumber(item.promptTokens.avg, 0),
      formatNumber(item.outputTokens.avg, 0),
      formatNumber(item.decodeTokensPerSecond.avg),
      formatMs(item.latency.p99),
      formatRangeMs(item.latency.ci95Low, item.latency.ci95High),
      formatPercent(item.repeatability),
      item.description || '-'
    ];

    if (mode === 'medium') {
      return base.slice(0, 8);
    }

    return base;
  });

  const headers = mode === 'medium'
    ? ['c', 'model', 'in avg', 'out avg', 'decode t/s', 'e2e p99', 'e2e 95% ci', 'repeat']
    : [
      'c',
      'model',
      'in tok avg',
      'out tok avg',
      'decode tok/s',
      'e2e p99',
      'e2e 95% ci',
      'repeat',
      'description'
    ];

  return renderTable(headers, rows, { ...options, maxCellWidth: mode === 'medium' ? 34 : 52 });
}

export function renderCompactSummary(summary, options = {}) {
  const width = options.width || 80;
  const separator = options.ascii ? '-' : '─';
  const lines = [];

  for (const item of summary) {
    const status = item.available ? (item.failures > 0 ? 'partial' : 'ok') : 'skipped';
    const title = `${item.model} c${formatConcurrency(item.concurrency)} ${status} ${item.attempted ? `${item.successes}/${item.attempted}` : '-'}`;
    lines.push(truncate(title, width));

    if (item.available) {
      lines.push(truncate(`  TTFT ${formatMs(item.ttft.p50)} p95 ${formatMs(item.ttft.p95)} | E2E ${formatMs(item.latency.p50)} p95 ${formatMs(item.latency.p95)} p99 ${formatMs(item.latency.p99)}`, width));
      const goodput = item.goodputRate == null ? '' : ` | good ${formatPercent(item.goodputRate)}`;
      lines.push(truncate(`  user ${formatNumber(item.tokensPerSecond.avg)} tok/s | system ${formatNumber(item.outputTokenThroughput)} tok/s | RPS ${formatNumber(item.rps)} | CV ${formatPercent(item.latency.cv)}${goodput}`, width));
      lines.push(truncate(`  in/out ${formatNumber(item.promptTokens.avg, 0)}/${formatNumber(item.outputTokens.avg, 0)} tok avg | TPOT ${formatMs(item.tpot.p50)} | repeat ${formatPercent(item.repeatability)}`, width));
    } else {
      lines.push(truncate(`  ${compactReason(item.skippedReason)}`, width));
    }
    lines.push(separator.repeat(Math.min(width, 72)));
  }

  if (lines.at(-1)?.startsWith(separator)) lines.pop();
  return lines.join('\n');
}

export function renderModelsTable(models, options = {}) {
  const width = terminalWidth(options);
  const compact = options.compact || width < 88;
  if (compact) {
    return models.map((model) => `${model.name} ${model.available ? 'yes' : 'no'} ${compactReason(model.reason || model.description || '-')}`).join('\n');
  }

  return renderTable(['model', 'available', 'description', 'quota'], models.map((model) => [
    model.name,
    model.available ? 'yes' : 'no',
    model.description || '-',
    compactReason(model.quota || model.reason || '-')
  ]), options);
}

function formatRangeMs(low, high) {
  if (low == null || high == null || !Number.isFinite(low) || !Number.isFinite(high)) return '-';
  return `${formatMs(Math.max(0, low))}..${formatMs(Math.max(0, high))}`;
}

function formatConcurrency(value) {
  return value == null ? '1' : String(value);
}

function terminalWidth(options = {}) {
  return options.width || process.stdout.columns || 120;
}

function compactLegend(width) {
  const text = 'TTFT = first streamed output. E2E = full response. TPOT = post-first-token decode cadence. CV = lower is steadier.';
  return truncate(text, width);
}

function formatSlo(slo = {}) {
  const parts = [];
  if (slo.ttftMs) parts.push(`TTFT<=${formatMs(slo.ttftMs)}`);
  if (slo.e2eMs) parts.push(`E2E<=${formatMs(slo.e2eMs)}`);
  if (slo.tpotMs) parts.push(`TPOT<=${formatMs(slo.tpotMs)}`);
  return parts.length ? `SLO ${parts.join(',')}` : '';
}

const ASCII_TABLE = {
  topLeft: '+',
  topJoin: '+',
  topRight: '+',
  midLeft: '+',
  midJoin: '+',
  midRight: '+',
  bottomLeft: '+',
  bottomJoin: '+',
  bottomRight: '+',
  horizontal: '-',
  vertical: '|'
};

const UNICODE_TABLE = {
  topLeft: '┌',
  topJoin: '┬',
  topRight: '┐',
  midLeft: '├',
  midJoin: '┼',
  midRight: '┤',
  bottomLeft: '└',
  bottomJoin: '┴',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│'
};

function rule(left, join, right, horizontal, widths) {
  return `${left}${widths.map((width) => horizontal.repeat(width + 2)).join(join)}${right}`;
}

function rowLine(row, widths, style, header = false) {
  return `${style.vertical}${row.map((cell, index) => {
    const value = header ? String(cell).toUpperCase() : formatCell(cell);
    return ` ${pad(value, widths[index], !header && isNumericCell(value))} `;
  }).join(style.vertical)}${style.vertical}`;
}

function formatCell(value) {
  if (value == null) return '';
  return String(value);
}

function pad(value, width, left = false) {
  const length = visibleLength(value);
  const padding = ' '.repeat(Math.max(0, width - length));
  return left ? `${padding}${value}` : `${value}${padding}`;
}

function isNumericCell(value) {
  return /^-?$|^[\d,.]+(?:ms|s|%)?$/.test(value);
}

function visibleLength(value) {
  return String(value).length;
}

function compactReason(value) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= 58) return clean;
  return `${clean.slice(0, 55)}...`;
}

function truncate(value, width) {
  const text = String(value ?? '');
  if (visibleLength(text) <= width) return text;
  if (width <= 1) return '…';
  return `${text.slice(0, width - 1)}…`;
}
