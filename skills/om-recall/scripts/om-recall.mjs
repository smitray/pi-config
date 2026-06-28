#!/usr/bin/env node
// om-recall: Query observational memory by date
// Usage: node om-recall.mjs [date] [--verbose]
// Date: yesterday, today, last N days, YYYY-MM-DD

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SESSIONS_DIR = join(homedir(), '.pi', 'agent', 'sessions', '--home-debasmitr-.pi-agent--');
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
  
  function localMidnight(year, month, day) {
    return new Date(Date.UTC(year, month, day) - offset * 3600000);
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

  const start = localMidnight(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  
  // For "last N days", end is today+1; otherwise start+1 day
  if (/^last\s+\d+\s+days?$/i.test(query)) {
    const end = localMidnight(y, m, d + 1);
    return { start, end };
  }
  return { start, end: new Date(start.getTime() + 86400000) };
}

// Extract OM entries from session file
function extractEntries(filePath) {
  const entries = [];
  const sessionId = filePath.split('/').pop()?.replace('.jsonl', '') || 'unknown';
  const lines = readFileSync(filePath, 'utf-8').split('\n').filter(l => l.trim());

  for (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (entry.type !== 'custom') continue;

    const data = entry.data;
    if (entry.customType === 'om.observations.recorded' && data?.observations) {
      for (const obs of data.observations) {
        entries.push({ type: 'observation', ...obs, sessionId });
      }
    }
    if (entry.customType === 'om.reflections.recorded' && data?.reflections) {
      for (const ref of data.reflections) {
        entries.push({ type: 'reflection', ...ref, sessionId });
      }
    }
  }
  return entries;
}

// Main
const offset = getTimezoneOffset();
const { start, end } = parseDateQuery(dateArg, offset);

if (!existsSync(SESSIONS_DIR)) {
  console.log('No session directory found.');
  process.exit(0);
}

const files = readdirSync(SESSIONS_DIR)
  .filter(f => f.endsWith('.jsonl'))
  .filter(f => {
    const match = f.match(/^(\d{4})-(\d{2})-(\d{2})T/);
    if (!match) return false;
    const fileDate = new Date(Date.UTC(+match[1], +match[2]-1, +match[3]));
    return fileDate >= start && fileDate < end;
  })
  .map(f => join(SESSIONS_DIR, f));

const allEntries = files.flatMap(extractEntries);
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
