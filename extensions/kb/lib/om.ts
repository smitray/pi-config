import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// ponytail: reads OM session JSONL files to extract observations/reflections by date.
// No embedding search — just timestamp filtering + relevance sorting.

interface OMObservation {
  id: string;
  content: string;
  timestamp: string;
  relevance: 'low' | 'medium' | 'high' | 'critical';
  tokenCount: number;
}

interface OMReflection {
  id: string;
  content: string;
  supportingObservationIds: string[];
  tokenCount: number;
}

export interface OMEntry {
  type: 'observation' | 'reflection';
  content: string;
  timestamp: string;
  relevance?: string;
  sessionId: string;
}

function getSessionsDir(): string {
  return join(homedir(), '.pi', 'agent', 'sessions', '--home-debasmitr-.pi-agent--');
}

function _getOmDebugDir(): string {
  return join(homedir(), '.pi', 'agent', 'observational-memory', 'debug');
}

/** Parse a date string (YYYY-MM-DD or "yesterday" or "today") into a Date range */
export function parseDateQuery(query: string): { start: Date; end: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (query === 'today') {
    return { start: today, end: new Date(today.getTime() + 86400000) };
  }
  if (query === 'yesterday') {
    const yesterday = new Date(today.getTime() - 86400000);
    return { start: yesterday, end: today };
  }

  // Try YYYY-MM-DD
  const match = query.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const d = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
    return { start: d, end: new Date(d.getTime() + 86400000) };
  }

  // Try "last N days"
  const daysMatch = query.match(/^last\s+(\d+)\s+days?$/i);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    return {
      start: new Date(today.getTime() - days * 86400000),
      end: new Date(today.getTime() + 86400000),
    };
  }

  // Default: today
  return { start: today, end: new Date(today.getTime() + 86400000) };
}

/** Find session files that overlap with a date range */
function findSessionsInRange(start: Date, end: Date): string[] {
  const dir = getSessionsDir();
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir).filter((f: string) => f.endsWith('.jsonl'));
  const results: string[] = [];

  for (const file of files) {
    // Parse timestamp from filename: 2026-06-25T01-52-58-551Z_sessionid.jsonl
    const tsMatch = file.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})/);
    if (!tsMatch) continue;

    const fileDate = new Date(
      parseInt(tsMatch[1], 10),
      parseInt(tsMatch[2], 10) - 1,
      parseInt(tsMatch[3], 10),
      parseInt(tsMatch[4], 10),
      parseInt(tsMatch[5], 10),
      parseInt(tsMatch[6], 10)
    );

    if (fileDate >= start && fileDate < end) {
      results.push(join(dir, file));
    }
  }

  return results;
}

/** Extract OM entries from a session JSONL file */
function extractOmEntries(filePath: string): OMEntry[] {
  const entries: OMEntry[] = [];
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((l: string) => l.trim());

  // Extract session ID from filename
  const sessionId = filePath.split('/').pop()?.replace('.jsonl', '') || 'unknown';

  for (const line of lines) {
    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    if (entry.type !== 'custom') continue;

    const customType = entry.customType as string;
    const data = entry.data as Record<string, unknown> | undefined;

    if (customType === 'om.observations.recorded' && data?.observations) {
      const observations = data.observations as OMObservation[];
      for (const obs of observations) {
        entries.push({
          type: 'observation',
          content: obs.content,
          timestamp: obs.timestamp,
          relevance: obs.relevance,
          sessionId,
        });
      }
    }

    if (customType === 'om.reflections.recorded' && data?.reflections) {
      const reflections = data.reflections as OMReflection[];
      for (const ref of reflections) {
        entries.push({
          type: 'reflection',
          content: ref.content,
          timestamp: (entry.timestamp as string) || '',
          sessionId,
        });
      }
    }

    // Also check compaction details for om.folded
    if (entry.details && typeof entry.details === 'object') {
      const details = entry.details as Record<string, unknown>;
      if (details.type === 'om.folded' && details.observations) {
        const observations = details.observations as OMObservation[];
        for (const obs of observations) {
          // Deduplicate by id
          if (!entries.some((e) => e.content === obs.content && e.type === 'observation')) {
            entries.push({
              type: 'observation',
              content: obs.content,
              timestamp: obs.timestamp,
              relevance: obs.relevance,
              sessionId,
            });
          }
        }
      }
      if (details.type === 'om.folded' && details.reflections) {
        const reflections = details.reflections as OMReflection[];
        for (const ref of reflections) {
          if (!entries.some((e) => e.content === ref.content && e.type === 'reflection')) {
            entries.push({
              type: 'reflection',
              content: ref.content,
              timestamp: (entry.timestamp as string) || '',
              sessionId,
            });
          }
        }
      }
    }
  }

  return entries;
}

/** Query OM memory for a date range */
export function queryOmMemory(dateQuery: string): OMEntry[] {
  const { start, end } = parseDateQuery(dateQuery);
  const sessionFiles = findSessionsInRange(start, end);

  const allEntries: OMEntry[] = [];
  for (const file of sessionFiles) {
    allEntries.push(...extractOmEntries(file));
  }

  // Sort by timestamp, newest first
  allEntries.sort((a, b) => {
    if (!a.timestamp) return 1;
    if (!b.timestamp) return -1;
    return b.timestamp.localeCompare(a.timestamp);
  });

  return allEntries;
}

/** Format OM entries for display */
export function formatOmEntries(entries: OMEntry[]): string {
  if (entries.length === 0) return '';

  const observations = entries.filter((e) => e.type === 'observation');
  const reflections = entries.filter((e) => e.type === 'reflection');

  const lines: string[] = [];

  if (reflections.length > 0) {
    lines.push('## Reflections (durable facts)');
    for (const ref of reflections) {
      lines.push(`- ${ref.content}`);
    }
    lines.push('');
  }

  if (observations.length > 0) {
    lines.push('## Observations (events & decisions)');
    for (const obs of observations) {
      const relevance = obs.relevance ? ` [${obs.relevance}]` : '';
      const time = obs.timestamp ? ` (${obs.timestamp.split('T')[1]?.split('.')[0] || ''})` : '';
      lines.push(`- ${obs.content}${relevance}${time}`);
    }
    lines.push('');
  }

  lines.push(`_Total: ${observations.length} observations, ${reflections.length} reflections_`);
  return lines.join('\n');
}
