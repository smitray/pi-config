import { spawn } from 'node:child_process';

/**
 * Async spawn helper shared across all extensions (gh, hooks, web-access).
 *
 * Returns a discriminated union — never throws. Callers branch on `ok`.
 * Sends SIGTERM after `timeoutMs`, escalates to SIGKILL 5s later so the
 * event loop never blocks on a stuck process.
 *
 * ponytail: this exists because three extensions all needed the same
 * child-process wrapper. Keep the API tight (5 options, 4-line result).
 * Upgrade rule: when one extension needs new behavior, add it as an OPTION,
 * not by forking this file again.
 */

export interface SpawnOptions {
  cwd?: string;
  /** Data piped to child stdin. If omitted, stdin is closed immediately. */
  input?: string;
  /** Extra env vars merged on top of process.env. */
  env?: Record<string, string | undefined>;
  /** Kill the process with SIGTERM after this many ms, then SIGKILL 5s later. Default 30_000. */
  timeoutMs?: number;
  /** Max bytes per stream (stdout, stderr) before truncation. Default 10 MB. */
  maxBuffer?: number;
}

export type SpawnResult =
  | { ok: true; stdout: string; stderr: string; exitCode: number; signal: string }
  | {
      ok: false;
      stdout: string;
      stderr: string;
      exitCode: number;
      signal: string;
      error: string;
    };

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024;
const SIGKILL_GRACE_MS = 5_000;

export function runCommand(
  bin: string,
  args: string[],
  options: SpawnOptions = {}
): Promise<SpawnResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBuffer = options.maxBuffer ?? DEFAULT_MAX_BUFFER;

  return new Promise((resolve) => {
    const proc = spawn(bin, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: options.cwd,
      env: { ...process.env, ...options.env } as NodeJS.ProcessEnv,
    });

    let stdout = '';
    let stderr = '';
    let truncated = false;
    let settled = false;

    const settle = (r: SpawnResult) => {
      if (settled) return;
      settled = true;
      if (killTimer) clearTimeout(killTimer);
      resolve(r);
    };

    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (chunk: string) => {
      if (stdout.length + chunk.length > maxBuffer) {
        stdout += chunk.slice(0, Math.max(0, maxBuffer - stdout.length));
        truncated = true;
      } else {
        stdout += chunk;
      }
    });

    proc.stderr.setEncoding('utf8');
    proc.stderr.on('data', (chunk: string) => {
      if (stderr.length + chunk.length > maxBuffer) {
        stderr += chunk.slice(0, Math.max(0, maxBuffer - stderr.length));
        truncated = true;
      } else {
        stderr += chunk;
      }
    });

    if (typeof options.input === 'string') {
      proc.stdin.write(options.input, 'utf8', () => proc.stdin.end());
    } else {
      proc.stdin.end();
    }

    const killTimer = setTimeout(() => {
      proc.kill('SIGTERM');
      setTimeout(() => {
        if (!settled) proc.kill('SIGKILL');
      }, SIGKILL_GRACE_MS);
    }, timeoutMs);

    proc.on('error', (err) => {
      settle({
        ok: false,
        stdout,
        stderr,
        exitCode: -1,
        signal: '',
        error: err.message,
      });
    });

    proc.on('exit', (exitCode, signal) => {
      const tail = '\n[output truncated]';
      settle({
        ok: exitCode === 0,
        stdout: truncated ? `${stdout}${tail}` : stdout,
        stderr: truncated ? `${stderr}${tail}` : stderr,
        exitCode: exitCode ?? -1,
        signal: signal ?? '',
        error: '',
      });
    });
  });
}
