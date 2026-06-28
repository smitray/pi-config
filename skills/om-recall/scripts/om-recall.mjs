#!/usr/bin/env node
// om-recall: Query observational memory by date
// Usage: node om-recall.mjs [date] [--verbose]
// Date: yesterday, today, last N days, YYYY-MM-DD

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SESSIONS_BASE = join(homedir(), '.pi', 'agent', 'sessions');
const SETTINGS_PATH = join(homedir(), '.pi', 'agent', 'settings.json');

// Parse args
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const dateArg = args.find(a => !a.startsWith('--')) || 'yesterday';

// Get timezone offset from settings or env
function getTimezoneOffset() {
  const env = process.env.OM_TIMEZONE_OFFSET;
  if (env) return parseFloat(env);
  try {
    const settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8'));
    if (typeof settings.om?.timezoneOffset === 'number') return settings.om.timezoneOffset;
  } catch {}
  return 0;
}

// Parse date query into UTC range
function parseDateQuery(query, offset) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  
  // UTC timestamp for local midnight
  function localMidnightUTC(year, month, day) {
    return Date.UTC(year, month, day) - offset * 3600000;
  }

  let startDate;
  if (query === 'today') {
    startDate = new Date(y, m, d);
  } else if (query === 'yesterday') {
    startDate = new Date(y, m, d - 1);
  } else if (/^last\s+(\d+)\s+days?$/i.test(query)) {
    const days = parseInt(query.match(/(\d+)/)[1]);
    startDate = new Date(y, m, d - days);
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(query)) {
    const [yr, mo, dy] = query.split('-').map(Number);
    startDate = new Date(yr, mo - 1, dy);
  } else {
    startDate = new Date(y, m, d);
  }

  const startMs = localMidnightUTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  
  // For "last N days", end is today+1; otherwise start+1 day
  if (/^last\s+\d+\s+days?$/i.test(query)) {
    const endMs = localMidnightUTC(y, m, d + 1);
    return { startMs, endMs };
  }
  return { startMs, endMs: startMs + 86400000 };
}

// Find ALL session directories
function getSessionDirs() {
  if (!existsSync(SESSIONS_BASE)) return [];
  return readdirSync(SESSIONS_BASE)
    .filter(d => statSync(join(SESSIONS_BASE, d)).isDirectory())
    .map(d => join(SESSIONS_BASE, d));
}

// Find session files across ALL directories within date range
function findSessionFiles(startMs, endMs) {
  const dirs = getSessionDirs();
  const results = [];
  
  for (const dir of dirs) {
    const files = readdirSync(dir).filter(f => f.endsWith('.jsonl'));
    for (const file of files) {
      // Parse UTC timestamp from filename: 2026-06-28T23-36-56-447Z_sessionid.jsonl
      const match = file.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})/);
      if (!match) continue;
      
      const fileMs = Date.UTC(
        parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]),
        parseInt(match[4]), parseInt(match[5]), parseInt(match[6])
      );
      
      // Include if session started within range (with 24h buffer for long sessions)
      if (fileMs >= startMs - 86400000 && fileMs < endMs) {
        results.push({ path: join(dir, file), fileMs });
      }
    }
  }
  
  // Sort by timestamp, newest first
  results.sort((a, b) => b.fileMs - a.fileMs);
  return results.map(r => r.path);
}

// Extract OM entries from a session file, optionally filtering by time range
function extractEntries(filePath, startMs, endMs) {
  const entries = [];
  const sessionId = filePath.split('/').pop()?.replace('.jsonl', '') || 'unknown';
  const lines = readFileSync(filePath, 'utf-8').split('\n').filter(l => l.trim());

  for (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    
    // Check for observation/reflection entries
    if (entry.type === 'custom') {
      const data = entry.data;
      const entryTime = entry.timestamp ? new Date(entry.timestamp).getTime() : 0;
      
      // Skip if entry is outside our time range
      if (entryTime && (entryTime < startMs || entryTime >= endMs)) continue;
      
      if (entry.customType === 'om.observations.recorded' && data?.observations) {
        for (const obs of data.observations) {
          entries.push({ type: 'observation', ...obs, sessionId });
        }
      }
      if (entry.customType === 'om.reflections.recorded' && data?.reflections) {
        for (const ref of data.reflections) {
          entries.push({ type: 'reflection', ...ref, sessionId, timestamp: entry.timestamp });
        }
      }
    }
    
    // Check compaction details
    if (entry.details && typeof entry.details === 'object') {
      const details = entry.details;
      if (details.type === 'om.folded') {
        const entryTime = entry.timestamp ? new Date(entry.timestamp).getTime() : 0;
        if (entryTime && (entryTime < startMs || entryTime >= endMs)) continue;
        
        if (details.observations) {
          for (const obs of details.observations) {
            entries.push({ type: 'observation', ...obs, sessionId });
          }
        }
        if (details.reflections) {
          for (const ref of details.reflections) {
            entries.push({ type: 'reflection', ...ref, sessionId, timestamp: entry.timestamp });
          }
        }
      }
    }
  }
  return entries;
}

// Deduplicate entries by content
function dedup(entries) {
  const seen = new Set();
  return entries.filter(e => {
    const key = `${e.type}:${e.content?.substring(0, 100)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Main
const offset = getTimezoneOffset();
const { startMs, endMs } = parseDateQuery(dateArg, offset);

const files = findSessionFiles(startMs, endMs);
const allEntries = dedup(files.flatMap(f => extractEntries(f, startMs, endMs)));

if (allEntries.length === 0) {
  console.log(`No observations found for "${dateArg}".`);
  process.exit(0);
}

const reflections = allEntries.filter(e => e.type === 'reflection');
const observations = allEntries.filter(e => e.type === 'observation');
const important = verbose ? observations : observations.filter(o => o.relevance === 'high' || o.relevance === 'critical');

if (reflections.length) {
  console.log('## Reflections');
  reflections.forEach(r => console.log(`- ${r.content}`));
  console.log();
}

if (important.length) {
  console.log('## Key Events');
  important.forEach(o => {
    const time = o.timestamp ? ` (${o.timestamp.split('T')[1]?.split('.')[0] || ''})` : '';
    console.log(`- ${o.content}${time}`);
  });
  console.log();
}

if (!verbose && observations.length > important.length) {
  console.log(`_${important.length} of ${observations.length} observations shown (use --verbose for all)_`);
}
