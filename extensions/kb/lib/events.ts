import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { VaultPaths } from './vault';
import { fmtDate } from './vault';

export interface EventInput {
  kind: string;
  data?: Record<string, unknown>;
}

/**
 * Append an event to meta/events.jsonl.
 *
 * ponytail: JSONL append — no read-modify-write, no locking. Each line is
 * a self-contained JSON object. Use `cat events.jsonl | jq` to query.
 */
export function logEvent(paths: VaultPaths, input: EventInput): void {
  const metaDir = paths.meta;
  mkdirSync(metaDir, { recursive: true });

  const eventsPath = join(metaDir, 'events.jsonl');
  const entry = {
    timestamp: fmtDate(),
    kind: input.kind,
    ...(input.data || {}),
  };

  appendFileSync(eventsPath, `${JSON.stringify(entry)}\n`, 'utf-8');
}
