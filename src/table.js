export function renderTable(headers, rows) {
  const stringRows = rows.map((row) => row.map(formatCell));
  const widths = headers.map((header, index) => {
    const values = [header, ...stringRows.map((row) => row[index] ?? '')];
    return Math.max(...values.map(visibleLength));
  });

  const separator = `+-${widths.map((width) => '-'.repeat(width)).join('-+-')}-+`;
  const headerLine = `| ${headers.map((header, index) => pad(header, widths[index])).join(' | ')} |`;
  const bodyLines = stringRows.map((row) => `| ${row.map((cell, index) => pad(cell, widths[index], isNumericCell(cell))).join(' | ')} |`);

  return [separator, headerLine, separator, ...bodyLines, separator].join('\n');
}

export function formatMs(value) {
  if (value == null) return '-';
  if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
  return `${Math.round(value)}ms`;
}

export function formatNumber(value, digits = 1) {
  if (value == null || !Number.isFinite(value)) return '-';
  if (Math.abs(value) >= 100) return Math.round(value).toLocaleString('en-US');
  return value.toFixed(digits);
}

export function renderSummaryTable(summary) {
  const rows = summary.map((item) => {
    const status = item.available ? (item.failures > 0 ? 'partial' : 'ok') : 'skipped';
    return [
      item.model,
      status,
      item.attempted || '-',
      item.successes || '-',
      item.failures || '-',
      formatMs(item.latency.p50),
      formatMs(item.latency.p95),
      formatMs(item.latency.avg),
      formatNumber(item.tokensPerSecond.avg),
      formatNumber(item.charsPerSecond.avg, 0),
      formatNumber(item.outputTokens.avg, 0),
      item.available ? '' : compactReason(item.skippedReason)
    ];
  });

  return renderTable([
    'model',
    'status',
    'runs',
    'ok',
    'fail',
    'p50',
    'p95',
    'avg',
    'tok/s',
    'char/s',
    'out tok',
    'note'
  ], rows);
}

export function renderModelsTable(models) {
  return renderTable(['model', 'available', 'description', 'quota'], models.map((model) => [
    model.name,
    model.available ? 'yes' : 'no',
    model.description || '-',
    compactReason(model.quota || model.reason || '-')
  ]));
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
  return /^-?$|^[\d,.]+(?:ms|s)?$/.test(value);
}

function visibleLength(value) {
  return String(value).length;
}

function compactReason(value) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= 58) return clean;
  return `${clean.slice(0, 55)}...`;
}
