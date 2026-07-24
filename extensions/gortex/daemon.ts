import { execFileSync, spawn } from 'node:child_process';
import { GORTEX_BIN } from './config';

/** Run a `gortex` subcommand and return trimmed stdout. */
export function runGortex(args: string[], input?: string): string {
  return execFileSync(GORTEX_BIN, args, {
    input,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 30_000,
  }).trim();
}

// Bring the shared Gortex daemon up, the way an MCP host's `gortex mcp` does
// for other agents. Idempotent, fire-and-forget (we don't block on the
// launcher's readiness poll), and never throws — a missing binary or spawn
// failure must not take the extension down. The first tool calls either find
// it ready or degrade gracefully.
export function ensureDaemon(): void {
  try {
    const child = spawn(GORTEX_BIN, ['daemon', 'start', '--detach'], {
      stdio: 'ignore',
      detached: true,
    });
    child.on('error', () => {}); // binary missing / spawn failure — swallow
    // No teardown counterpart, by design: the daemon is shared, long-lived
    // infrastructure that outlives the session — like `gortex mcp`.
    child.unref();
  } catch {}
}
