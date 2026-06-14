import { formatMs } from './table.js';

const UNICODE_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const ASCII_FRAMES = ['-', '\\', '|', '/'];

const TONES = {
  green: ['\x1b[32m', '\x1b[0m'],
  yellow: ['\x1b[33m', '\x1b[0m'],
  red: ['\x1b[31m', '\x1b[0m'],
  dim: ['\x1b[2m', '\x1b[0m']
};

export function createProgress(options = {}) {
  const stream = options.stream || process.stderr;
  const enabled = options.enabled === true || (options.enabled === 'auto' && Boolean(stream.isTTY));
  if (!enabled) return noopProgress();
  return new StatusLine({ ...options, stream });
}

function noopProgress() {
  return {
    update() {},
    stop() {}
  };
}

class StatusLine {
  constructor(options = {}) {
    this.stream = options.stream || process.stderr;
    this.color = Boolean(options.color);
    this.ascii = Boolean(options.ascii);
    this.frames = this.ascii ? ASCII_FRAMES : UNICODE_FRAMES;
    this.frameIndex = 0;
    this.startedAt = Date.now();
    this.state = {
      phase: 'starting',
      message: 'starting',
      completed: 0,
      failed: 0,
      total: null
    };
    this.timer = setInterval(() => this.render(), 90);
    this.timer.unref?.();
    this.render();
  }

  update(event = {}) {
    if (event.type === 'phase') {
      this.state.phase = event.phase || 'working';
      this.state.message = event.message || this.state.message;
    } else if (event.type === 'tokens:start') {
      this.state.phase = 'tokens';
      this.state.message = event.message || 'counting prompt tokens';
      this.state.completed = 0;
      this.state.total = event.total;
    } else if (event.type === 'tokens:progress') {
      this.state.phase = 'tokens';
      this.state.message = `counted ${event.promptId || 'prompt'}`;
      this.state.completed = event.completed;
      this.state.total = event.total;
    } else if (event.type === 'benchmark:start') {
      this.state.phase = 'benchmark';
      this.state.message = `running ${event.modelCount} model(s), ${event.promptCount} prompt(s)`;
      this.state.completed = 0;
      this.state.failed = 0;
      this.state.total = event.total;
    } else if (event.type === 'warmup:start') {
      this.state.phase = 'warmup';
      this.state.message = `warming c${event.concurrency} (${event.scenarioIndex}/${event.scenarioCount})`;
      this.state.completed = 0;
      this.state.total = event.total;
    } else if (event.type === 'warmup:progress') {
      this.state.phase = 'warmup';
      this.state.message = `warmed ${event.model || 'model'} at c${event.concurrency}`;
      this.state.completed = event.completed;
      this.state.total = event.total;
    } else if (event.type === 'scenario:start') {
      this.state.phase = 'benchmark';
      this.state.message = `measuring c${event.concurrency} (${event.scenarioIndex}/${event.scenarioCount})`;
      this.state.total = event.total ?? this.state.total;
    } else if (event.type === 'benchmark:progress') {
      this.state.phase = 'benchmark';
      this.state.message = `${event.model} ${event.promptId} run ${event.run} ${event.ok ? 'ok' : 'failed'} (${formatMs(event.durationMs)})`;
      this.state.completed = event.completed;
      this.state.failed = event.failed;
      this.state.total = event.total;
    } else if (event.type === 'benchmark:complete') {
      this.state.phase = 'complete';
      this.state.message = `complete ${event.completed}/${event.total}`;
      this.state.completed = event.completed;
      this.state.failed = event.failed;
      this.state.total = event.total;
    }
    this.render();
  }

  stop(finalMessage = '') {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.stream.clearLine && this.stream.cursorTo) {
      this.clearLine();
    } else {
      this.stream.write('\n');
    }
    if (finalMessage) this.stream.write(`${finalMessage}\n`);
  }

  render() {
    const width = this.stream.columns || process.stderr.columns || 100;
    const elapsed = Date.now() - this.startedAt;
    const frame = this.frames[this.frameIndex % this.frames.length];
    this.frameIndex += 1;
    const progress = progressText(this.state);
    const eta = etaText(this.state, elapsed);
    const failures = this.state.failed > 0 ? this.tone(`fail ${this.state.failed}`, 'red') : '';
    const parts = [
      this.tone(frame, 'green'),
      'fm-bench',
      this.state.phase,
      progress,
      eta,
      failures,
      this.tone(this.state.message, 'dim')
    ].filter(Boolean);
    this.writeLine(truncateVisible(parts.join('  '), Math.max(20, width - 1)));
  }

  writeLine(line) {
    if (this.stream.clearLine && this.stream.cursorTo) {
      this.stream.clearLine(0);
      this.stream.cursorTo(0);
      this.stream.write(line);
    } else {
      this.stream.write(`\r${line}`);
    }
  }

  clearLine() {
    if (this.stream.clearLine && this.stream.cursorTo) {
      this.stream.clearLine(0);
      this.stream.cursorTo(0);
    } else {
      this.stream.write('\r');
    }
  }

  tone(text, tone) {
    if (!this.color || !TONES[tone]) return text;
    const [open, close] = TONES[tone];
    return `${open}${text}${close}`;
  }
}

function progressText(state) {
  if (!Number.isFinite(state.total) || state.total <= 0) return '';
  const completed = Math.min(state.completed || 0, state.total);
  const percent = Math.round((completed / state.total) * 100);
  return `${completed}/${state.total} ${percent}%`;
}

function etaText(state, elapsedMs) {
  if (!Number.isFinite(state.total) || state.total <= 0 || !Number.isFinite(state.completed) || state.completed <= 0) {
    return '';
  }
  const remaining = Math.max(0, state.total - state.completed);
  if (remaining === 0) return `elapsed ${formatMs(elapsedMs)}`;
  const perItemMs = elapsedMs / state.completed;
  return `eta ${formatMs(perItemMs * remaining)}`;
}

function truncateVisible(value, width) {
  const text = String(value);
  const clean = text.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '');
  if (clean.length <= width) return text;
  let visible = 0;
  let output = '';
  for (let index = 0; index < text.length && visible < width - 1; index += 1) {
    if (text[index] === '\x1b') {
      const match = text.slice(index).match(/^\u001b\[[0-?]*[ -/]*[@-~]/);
      if (match) {
        output += match[0];
        index += match[0].length - 1;
        continue;
      }
    }
    output += text[index];
    visible += 1;
  }
  return `${output}…`;
}
