import { spawn } from 'node:child_process';

export function runProcess(command, args = [], options = {}) {
  const {
    input,
    timeoutMs = 30_000,
    env = process.env,
    cwd = process.cwd()
  } = options;

  return new Promise((resolve) => {
    const startedAt = process.hrtime.bigint();
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const timer = timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          child.kill('SIGTERM');
          setTimeout(() => {
            if (!settled) child.kill('SIGKILL');
          }, 1_000).unref();
        }, timeoutMs)
      : null;

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', (error) => {
      settled = true;
      if (timer) clearTimeout(timer);
      const endedAt = process.hrtime.bigint();
      resolve({
        command,
        args,
        code: null,
        signal: null,
        stdout,
        stderr: stderr || error.message,
        error,
        timedOut,
        durationMs: Number(endedAt - startedAt) / 1e6
      });
    });

    child.on('close', (code, signal) => {
      settled = true;
      if (timer) clearTimeout(timer);
      const endedAt = process.hrtime.bigint();
      resolve({
        command,
        args,
        code,
        signal,
        stdout,
        stderr,
        timedOut,
        durationMs: Number(endedAt - startedAt) / 1e6
      });
    });

    if (input != null) {
      child.stdin.end(input);
    } else {
      child.stdin.end();
    }
  });
}
