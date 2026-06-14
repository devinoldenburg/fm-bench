import { stripAnsi } from './ansi.js';

export function renderTable(headers, rows, options = {}) {
  const ascii = Boolean(options.ascii);
  const maxCellWidth = options.maxCellWidth || 60;
  const normalizedRows = rows.map((row) => row.map((cell) => {
    const normalized = normalizeCell(cell);
    return {
      ...normalized,
      text: truncate(normalized.text, maxCellWidth)
    };
  }));
  const widths = headers.map((header, index) => {
    const values = [truncate(header, maxCellWidth), ...normalizedRows.map((row) => row[index]?.text ?? '')];
    return Math.max(...values.map(visibleLength));
  });
  const style = ascii ? ASCII_TABLE : UNICODE_TABLE;

  const top = rule(style.topLeft, style.topJoin, style.topRight, style.horizontal, widths);
  const middle = rule(style.midLeft, style.midJoin, style.midRight, style.horizontal, widths);
  const bottom = rule(style.bottomLeft, style.bottomJoin, style.bottomRight, style.horizontal, widths);
  const headerLine = rowLine(headers.map((header) => truncate(header, maxCellWidth)), widths, style, true, options);
  const bodyLines = normalizedRows.map((row) => rowLine(row, widths, style, false, options));

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
    lines.push(renderCompactSummary(payload.summary, { ...options, width, slo: payload.options.slo }));
  } else {
    lines.push(renderSummaryTable(payload.summary, { ...options, mode, width, slo: payload.options.slo }));
    lines.push('');
    lines.push(renderDetailTable(payload.summary, { ...options, mode, width, slo: payload.options.slo }));
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
  const ranks = rankSummary(summary);
  const rows = summary.map((item) => {
    const status = item.available ? (item.failures > 0 ? 'partial' : 'ok') : 'skipped';
    const tones = metricTones(item, ranks, options.slo);
    const base = [
      cell(formatConcurrency(item.concurrency)),
      cell(item.model, item.available ? null : 'muted'),
      cell(status, statusTone(status)),
      cell(item.attempted ? `${item.successes}/${item.attempted}` : '-', item.failures > 0 ? 'yellow' : item.available ? 'green' : 'muted'),
      cell(formatPercent(item.successRate), percentTone(item.successRate, 0.95, 1)),
      cell(formatPercent(item.goodputRate), percentTone(item.goodputRate, 0.8, 1)),
      cell(formatNumber(item.goodputRps), tones.goodputRps),
      cell(formatMs(item.ttft.p50), tones.ttft),
      cell(formatMs(item.ttft.p95), tones.ttftP95),
      cell(formatMs(item.latency.p50), tones.e2e),
      cell(formatMs(item.latency.p95), tones.e2eP95),
      cell(formatNumber(item.tokensPerSecond.avg), tones.userTps),
      cell(formatNumber(item.outputTokenThroughput), tones.systemTps),
      cell(formatNumber(item.rps), tones.rps),
      cell(formatPercent(item.latency.cv), cvTone(item.latency.cv)),
      cell(item.available ? '' : compactReason(item.skippedReason), item.available ? null : 'yellow')
    ];

    if (mode === 'medium') {
      const medium = [
        base[0],
        base[1],
        base[2],
        base[3]
      ];
      if (hasGoodput) medium.push(base[5], base[6]);
      medium.push(base[7], base[9], base[10], base[11], base[12], base[14], base[15]);
      return medium;
    }

    const wide = [base[0], base[1], base[2], base[3], base[4]];
    if (hasGoodput) wide.push(base[5], base[6]);
    wide.push(
      base[7],
      base[8],
      base[9],
      base[10],
      cell(formatMs(item.tpot.p50), tones.tpot),
      cell(formatMs(item.tpot.p95), tones.tpotP95),
      base[11],
      base[12],
      base[13],
      base[14],
      base[15]
    );
    return wide;
  });

  const mediumHeaders = ['c', 'model', 'status', 'ok', 'good', 'good rps', 'ttft', 'e2e', 'e2e p95', 'user/s', 'sys/s', 'cv', 'note'];
  const wideHeaders = ['c', 'model', 'status', 'ok/runs', 'succ', 'good', 'good rps', 'ttft', 'ttft p95', 'e2e', 'e2e p95', 'tpot', 'tpot p95', 'user t/s', 'sys t/s', 'rps', 'cv', 'note'];
  const headers = mode === 'medium'
    ? (hasGoodput ? mediumHeaders : mediumHeaders.filter((header) => header !== 'good' && header !== 'good rps'))
    : (hasGoodput ? wideHeaders : wideHeaders.filter((header) => header !== 'good' && header !== 'good rps'));

  return renderTable(headers, rows, { ...options, maxCellWidth: mode === 'medium' ? 24 : 52 });
}

export function renderDetailTable(summary, options = {}) {
  const mode = options.mode || 'wide';
  const ranks = rankSummary(summary);
  const rows = summary.map((item) => {
    const tones = metricTones(item, ranks, options.slo);
    const base = [
      cell(formatConcurrency(item.concurrency)),
      cell(item.model, item.available ? null : 'muted'),
      cell(formatNumber(item.promptTokens.avg, 0)),
      cell(formatNumber(item.outputTokens.avg, 0)),
      cell(formatNumber(item.prefillTokensPerSecond?.avg), tones.prefillTps),
      cell(formatNumber(item.decodeTokensPerSecond?.avg), tones.decodeTps),
      cell(formatMs(item.secondChunk?.p50), tones.secondChunk),
      cell(formatMs(item.chunkGap?.p95), tones.chunkGapP95),
      cell(formatMs(item.latency.p99), tones.e2eP99),
      cell(formatRangeMs(item.latency.ci95Low, item.latency.ci95High), cvTone(item.latency.cv)),
      cell(formatPercent(item.repeatability), percentTone(item.repeatability, 0.5, 0.9)),
      cell(item.description || '-', 'muted')
    ];

    if (mode === 'medium') {
      return [base[0], base[1], base[2], base[3], base[4], base[5], base[7], base[8], base[10]];
    }

    return base;
  });

  const headers = mode === 'medium'
    ? ['c', 'model', 'in avg', 'out avg', 'prefill/s', 'decode/s', 'chunk p95', 'e2e p99', 'repeat']
    : [
      'c',
      'model',
      'in tok avg',
      'out tok avg',
      'prefill tok/s',
      'decode tok/s',
      '2nd chunk',
      'chunk p95',
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
  const ranks = rankSummary(summary);

  for (const item of summary) {
    const status = item.available ? (item.failures > 0 ? 'partial' : 'ok') : 'skipped';
    const title = `${item.model} c${formatConcurrency(item.concurrency)} ${status} ${item.attempted ? `${item.successes}/${item.attempted}` : '-'}`;
    lines.push(toneText(truncate(title, width), statusTone(status), options));

    if (item.available) {
      const goodput = item.goodputRate == null ? '' : ` | good ${formatPercent(item.goodputRate)}`;
      const tones = metricTones(item, ranks, options.slo);
      lines.push(toneText(truncate(`  TTFT ${formatMs(item.ttft.p50)} p95 ${formatMs(item.ttft.p95)} | E2E ${formatMs(item.latency.p50)} p95 ${formatMs(item.latency.p95)} p99 ${formatMs(item.latency.p99)}`, width), worstTone(tones.ttft, tones.e2e, tones.e2eP95), options));
      lines.push(toneText(truncate(`  user ${formatNumber(item.tokensPerSecond.avg)} tok/s | system ${formatNumber(item.outputTokenThroughput)} tok/s | RPS ${formatNumber(item.rps)} | CV ${formatPercent(item.latency.cv)}${goodput}`, width), worstTone(tones.userTps, tones.systemTps, cvTone(item.latency.cv), percentTone(item.goodputRate, 0.8, 1)), options));
      lines.push(toneText(truncate(`  prefill ${formatNumber(item.prefillTokensPerSecond?.avg)} tok/s | TPOT ${formatMs(item.tpot.p50)} | chunk p95 ${formatMs(item.chunkGap?.p95)}`, width), worstTone(tones.prefillTps, tones.tpot, tones.chunkGapP95), options));
      lines.push(toneText(truncate(`  in/out ${formatNumber(item.promptTokens.avg, 0)}/${formatNumber(item.outputTokens.avg, 0)} tok avg | repeat ${formatPercent(item.repeatability)}`, width), percentTone(item.repeatability, 0.5, 0.9), options));
    } else {
      lines.push(toneText(truncate(`  ${compactReason(item.skippedReason)}`, width), 'yellow', options));
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
    return models.map((model) => {
      const status = model.available ? 'yes' : 'no';
      return `${model.name} ${toneText(status, model.available ? 'green' : 'yellow', options)} ${compactReason(model.reason || model.description || '-')}`;
    }).join('\n');
  }

  return renderTable(['model', 'available', 'description', 'quota'], models.map((model) => [
    cell(model.name),
    cell(model.available ? 'yes' : 'no', model.available ? 'green' : 'yellow'),
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

function rowLine(row, widths, style, header = false, options = {}) {
  return `${style.vertical}${row.map((cell, index) => {
    const normalized = header ? { text: String(cell).toUpperCase(), tone: 'header' } : normalizeCell(cell);
    const value = normalized.text;
    const padded = pad(value, widths[index], !header && isNumericCell(value));
    return ` ${toneText(padded, normalized.tone, options)} `;
  }).join(style.vertical)}${style.vertical}`;
}

function cell(text, tone = null) {
  return { text, tone };
}

function normalizeCell(value) {
  if (value && typeof value === 'object' && Object.hasOwn(value, 'text')) {
    return {
      text: formatCell(value.text),
      tone: value.tone || null
    };
  }
  return {
    text: formatCell(value),
    tone: null
  };
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
  return stripAnsi(value).length;
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

const TONES = {
  header: ['\x1b[1m', '\x1b[0m'],
  green: ['\x1b[32m', '\x1b[0m'],
  yellow: ['\x1b[33m', '\x1b[0m'],
  red: ['\x1b[31m', '\x1b[0m'],
  muted: ['\x1b[2m', '\x1b[0m']
};

function toneText(text, tone, options = {}) {
  if (!options.color || !tone || !TONES[tone]) return text;
  const [open, close] = TONES[tone];
  return `${open}${text}${close}`;
}

function statusTone(status) {
  if (status === 'ok') return 'green';
  if (status === 'partial') return 'yellow';
  if (status === 'skipped') return 'yellow';
  return 'red';
}

function percentTone(value, yellowAt, greenAt) {
  if (value == null || !Number.isFinite(value)) return null;
  if (value >= greenAt) return 'green';
  if (value >= yellowAt) return 'yellow';
  return 'red';
}

function cvTone(value) {
  if (value == null || !Number.isFinite(value)) return null;
  if (value <= 0.1) return 'green';
  if (value <= 0.25) return 'yellow';
  return 'red';
}

function thresholdTone(value, threshold) {
  if (value == null || !Number.isFinite(value) || !Number.isFinite(threshold)) return null;
  if (value <= threshold * 0.8) return 'green';
  if (value <= threshold) return 'yellow';
  return 'red';
}

function rankSummary(summary) {
  return {
    ttft: collectMetric(summary, (item) => item.ttft?.p50),
    ttftP95: collectMetric(summary, (item) => item.ttft?.p95),
    e2e: collectMetric(summary, (item) => item.latency?.p50),
    e2eP95: collectMetric(summary, (item) => item.latency?.p95),
    e2eP99: collectMetric(summary, (item) => item.latency?.p99),
    tpot: collectMetric(summary, (item) => item.tpot?.p50),
    tpotP95: collectMetric(summary, (item) => item.tpot?.p95),
    secondChunk: collectMetric(summary, (item) => item.secondChunk?.p50),
    chunkGapP95: collectMetric(summary, (item) => item.chunkGap?.p95),
    userTps: collectMetric(summary, (item) => item.tokensPerSecond?.avg),
    systemTps: collectMetric(summary, (item) => item.outputTokenThroughput),
    totalTps: collectMetric(summary, (item) => item.totalTokenThroughput),
    rps: collectMetric(summary, (item) => item.rps),
    goodputRps: collectMetric(summary, (item) => item.goodputRps),
    decodeTps: collectMetric(summary, (item) => item.decodeTokensPerSecond?.avg),
    prefillTps: collectMetric(summary, (item) => item.prefillTokensPerSecond?.avg)
  };
}

function collectMetric(summary, accessor) {
  return summary.map(accessor).filter((value) => Number.isFinite(value));
}

function rankTone(value, values) {
  if (value == null || !Number.isFinite(value) || values.length === 0) return null;
  if (values.length === 1) return 'green';
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return 'green';
  const position = (value - min) / (max - min);
  if (position >= 0.67) return 'green';
  if (position >= 0.34) return 'yellow';
  return 'red';
}

function rankToneLower(value, values) {
  if (value == null || !Number.isFinite(value) || values.length === 0) return null;
  if (values.length === 1) return 'green';
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return 'green';
  const position = (max - value) / (max - min);
  if (position >= 0.67) return 'green';
  if (position >= 0.34) return 'yellow';
  return 'red';
}

function metricTones(item, ranks, slo = {}) {
  return {
    ttft: thresholdTone(item.ttft?.p50, slo.ttftMs) || rankToneLower(item.ttft?.p50, ranks.ttft),
    ttftP95: thresholdTone(item.ttft?.p95, slo.ttftMs) || rankToneLower(item.ttft?.p95, ranks.ttftP95),
    e2e: thresholdTone(item.latency?.p50, slo.e2eMs) || rankToneLower(item.latency?.p50, ranks.e2e),
    e2eP95: thresholdTone(item.latency?.p95, slo.e2eMs) || rankToneLower(item.latency?.p95, ranks.e2eP95),
    e2eP99: thresholdTone(item.latency?.p99, slo.e2eMs) || rankToneLower(item.latency?.p99, ranks.e2eP99),
    tpot: thresholdTone(item.tpot?.p50, slo.tpotMs) || rankToneLower(item.tpot?.p50, ranks.tpot),
    tpotP95: thresholdTone(item.tpot?.p95, slo.tpotMs) || rankToneLower(item.tpot?.p95, ranks.tpotP95),
    secondChunk: rankToneLower(item.secondChunk?.p50, ranks.secondChunk),
    chunkGapP95: rankToneLower(item.chunkGap?.p95, ranks.chunkGapP95),
    userTps: rankTone(item.tokensPerSecond?.avg, ranks.userTps),
    systemTps: rankTone(item.outputTokenThroughput, ranks.systemTps),
    totalTps: rankTone(item.totalTokenThroughput, ranks.totalTps),
    rps: rankTone(item.rps, ranks.rps),
    goodputRps: goodputRpsTone(item, ranks.goodputRps),
    decodeTps: rankTone(item.decodeTokensPerSecond?.avg, ranks.decodeTps),
    prefillTps: rankTone(item.prefillTokensPerSecond?.avg, ranks.prefillTps)
  };
}

function worstTone(...tones) {
  if (tones.includes('red')) return 'red';
  if (tones.includes('yellow')) return 'yellow';
  if (tones.includes('green')) return 'green';
  return null;
}

function goodputRpsTone(item, values) {
  const passTone = percentTone(item.goodputRate, 0.8, 1);
  if (passTone && passTone !== 'green') return passTone;
  return rankTone(item.goodputRps, values) || passTone;
}
