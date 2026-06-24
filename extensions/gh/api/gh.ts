import { runCommand, type SpawnResult } from '../../_shared/spawn';

/**
 * gh CLI async wrapper. Returns the discriminated union from `runCommand` —
 * never throws. Callers branch on `.ok`.
 */
export async function gh(args: string[], stdin?: string): Promise<SpawnResult> {
  return runCommand('gh', args, stdin !== undefined ? { input: stdin } : {});
}

/**
 * Convenience: run gh with `-R owner/repo` shorthand. Most call sites
 * need this; centralising it keeps tool files tidy.
 */
export async function ghRepo(owner: string, repo: string, args: string[]): Promise<SpawnResult> {
  return gh(['-R', `${owner}/${repo}`, ...args]);
}

/**
 * Map a SpawnResult to a single-line error message.
 * Spawn failure (exitCode -1): return the spawn error verbatim.
 * Non-zero exit: stderr, falling back to stdout, then "exit N".
 * Zero exit: empty string.
 */
export function spawnErrorMessage(r: SpawnResult): string {
  if (!r.ok && r.exitCode === -1) return r.error;
  if (r.exitCode !== 0) {
    return r.stderr.trim() || r.stdout.trim() || `exit ${r.exitCode}`;
  }
  return '';
}
