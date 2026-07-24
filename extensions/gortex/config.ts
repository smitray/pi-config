import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';

// Resolve the gortex binary without hardcoding the user's home path.
// XDG-first (Arch default: $XDG_BIN_HOME), then the conventional
// ~/.local/bin, then a PATH search, then a last-resort default so the tool
// still attempts to run and fails loudly if the binary is truly missing.
// The pi agent adapter used to splice the absolute path in as an install-time
// sentinel; resolving at runtime is cleaner and portable across machines.
function resolveGortexBin(): string {
  const candidates: string[] = [];
  const xdgBin = process.env.XDG_BIN_HOME?.trim();
  if (xdgBin) candidates.push(join(xdgBin, 'gortex'));
  candidates.push(join(homedir(), '.local', 'bin', 'gortex'));
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    if (dir) candidates.push(join(dir, 'gortex'));
  }
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0] ?? 'gortex';
}

export const GORTEX_BIN: string = resolveGortexBin();

export const HOOK_ARGV: string[] = [GORTEX_BIN, 'hook', '--agent=pi'];

/** When false, the graph tools are still wired but the read-discipline
 * enforcement hook is not registered (equivalent to `--no-hooks`). */
export const ENFORCE: boolean = true;

/** Prefix so a Gortex tool can never clobber a Pi built-in or another
 * extension's tool of the same bare name. */
export const TOOL_PREFIX = 'gortex_';

export const GORTEX_INSTRUCTIONS: string =
  '## MANDATORY: Use the Gortex public CLI mirror instead of raw source reads/searches\n\nThis harness has no native MCP transport. Invoke public Gortex tools only as `gortex call \u003ctool\u003e`; never invent a bare `gortex \u003ctool\u003e` command.\n\n1. Start every coding task with `gortex call explore --arg task="\u003ctask\u003e"`.\n2. Inspect with `gortex call search`, `gortex call read`, `gortex call relations`, or `gortex call trace` instead of Read/Grep/Glob or shell equivalents. Read a whole file with `gortex call read --arg operation=file --arg target:=\\"file\\":\\"\u003cpath\u003e\\"`.\n3. Before mutation call `gortex call change --arg operation=impact`. Mutate only through `gortex call edit` or `gortex call refactor`; afterward run change operations `detect`, `tests`, `guards`, and `contract`.\n4. Use `gortex call capabilities` only when exact operation fields are unknown.\n';
