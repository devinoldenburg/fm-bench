export function renderTable(headers, rows, options = {}) {
  const ascii = Boolean(options.ascii);
  const stringRows = rows.map((row) => row.map(formatCell));
  const widths = headers.map((header, index) => {
    const values = [header, ...stringRows.map((row) => row[index] ?? '')];
    return Math.max(...values.map(visibleLength));
  });
  const style = ascii ? ASCII_TABLE : UNICODE_TABLE;

  const top = rule(style.topLeft, style.topJoin, style.topRight, style.horizontal, widths);
  const middle = rule(style.midLeft, style.midJoin, style.midRight, style.horizontal, widths);
  const bottom = rule(style.bottomLeft, style.bottomJoin, style.bottomRight, style.horizontal, widths);
  const headerLine = rowLine(headers, widths, style, true);
  const bodyLines = stringRows.map((row) => rowLine(row, widths, style));

  return [top, headerLine, middle, ...bodyLines, bottom].join('\n');
}

export function renderBenchmarkReport(payload, options = {}) {
  const lines = [];
  const elapsedMs = Date.parse(payload.finishedAt) - Date.parse(payload.startedAt);
  const skipped = payload.summary.filter((item) => !item.available).length;
  const measured = payload.summary.reduce((sum, item) => sum + item.successes, 0);
  const failed = payload.summary.reduce((sum, item) => sum + item.failures, 0);

  lines.push(`fm-bench ${payload.version} | ${payload.environment.platform}/${payload.environment.arch} | ${payload.environment.fmBin}`);
  lines.push(`prompts ${payload.prompts.length} | runs ${payload.options.runs} | concurrency ${payload.options.concurrency} | stream ${payload.options.stream ? 'on' : 'off'} | measured ${measured} | failed ${failed} | skipped models ${skipped} | elapsed ${formatMs(elapsedMs)}`);
  lines.push('');
  lines.push(renderSummaryTable(payload.summary, options));
  lines.push('');
  lines.push(renderDetailTable(payload.summary, options));
  lines.push('');
  lines.push('TTFT = time to first streamed output, E2E = full response latency, TPOT = decode time per output token.');

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
  const rows = summary.map((item) => {
    const status = item.available ? (item.failures > 0 ? 'partial' : 'ok') : 'skipped';
    return [
      item.model,
      status,
      item.attempted || '-',
      item.successes || '-',
      formatPercent(item.successRate),
      formatMs(item.ttft.p50),
      formatMs(item.ttft.p95),
      formatMs(item.latency.p50),
      formatMs(item.latency.p95),
      formatMs(item.tpot.p50),
      formatNumber(item.tokensPerSecond.avg),
      formatNumber(item.rps),
      item.available ? '' : compactReason(item.skippedReason)
    ];
  });

  return renderTable([
    'model',
    'status',
    'runs',
    'ok',
    'success',
    'ttft p50',
    'ttft p95',
    'e2e p50',
    'e2e p95',
    'tpot p50',
    'tok/s',
    'rps',
    'note'
  ], rows, options);
}

export function renderDetailTable(summary, options = {}) {
  const rows = summary.map((item) => [
    item.model,
    formatNumber(item.promptTokens.avg, 0),
    formatNumber(item.outputTokens.avg, 0),
    formatNumber(item.outputTokenThroughput),
    formatNumber(item.decodeTokensPerSecond.avg),
    formatMs(item.latency.p99),
    formatMs(item.tpot.p95),
    formatPercent(item.repeatability),
    item.description || '-'
  ]);

  return renderTable([
    'model',
    'in tok avg',
    'out tok avg',
    'total tok/s',
    'decode tok/s',
    'e2e p99',
    'tpot p95',
    'repeat',
    'description'
  ], rows, options);
}

export function renderModelsTable(models, options = {}) {
  return renderTable(['model', 'available', 'description', 'quota'], models.map((model) => [
    model.name,
    model.available ? 'yes' : 'no',
    model.description || '-',
    compactReason(model.quota || model.reason || '-')
  ]), options);
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
