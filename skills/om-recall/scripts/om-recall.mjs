#!/usr/bin/env node
// om-recall: Query observational memory by date (productive days only)
// Usage: node om-recall.mjs [date] [--verbose] [--project /path/to/repo]
// Date: yesterday, today, last N days, YYYY-MM-DD

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';

const SESSIONS_BASE = join(homedir(), '.pi', 'agent', 'sessions');
const SETTINGS_PATH = join(homedir(), '.pi', 'agent', 'settings.json');

// Parse args
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const projectIdx = args.indexOf('--project');
const projectPath = projectIdx >= 0 ? resolve(args[projectIdx + 1]) : process.cwd();
// Find date arg: first arg that isn't a flag and isn't the value after --project
const dateArg = args.find((a, i) => !a.startsWith('--') && (projectIdx < 0 || i !== projectIdx + 1)) || 'yesterday';

// Get timezone offset from settings or env
function getTimezoneOffset() {
  const env = process.env.OM_TIMEZONE_OFFSET;
  if (env) return parseFloat(env);
  try {
    const settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8'));
    // Support both om.timezoneOffset and observational-memory.timezoneOffset
    if (typeof settings['observational-memory']?.timezoneOffset === 'number') 
      return settings['observational-memory'].timezoneOffset;
    if (typeof settings.om?.timezoneOffset === 'number') 
      return settings.om.timezoneOffset;
  } catch {}
  return 0;
}

// Parse date query into UTC range
function parseDateQuery(query, offset) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  
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
  
  if (/^last\s+\d+\s+days?$/i.test(query)) {
    const endMs = localMidnightUTC(y, m, d + 1);
    return { startMs, endMs, startDate, endDate: new Date(y, m, d) };
  }
  return { startMs, endMs: startMs + 86400000, startDate, endDate: startDate };
}

// Check git log for commits on a date range (local time)
function getGitCommits(repoPath, startDate, endDate) {
  try {
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = new Date(endDate.getTime() + 86400000).toISOString().split('T')[0];
    const log = execSync(
      `git log --oneline --after="${startStr}" --before="${endStr}" --format="%h %s"`,
      { cwd: repoPath, encoding: 'utf-8', timeout: 5000 }
    ).trim();
    return log ? log.split('\n') : [];
  } catch {
    return [];
  }
}

// Map project path to session directory name
function getSessionDirForProject(projectPath) {
  // Session dirs are named like --home-debasmitr-.pi-agent--
  // Convert path: /home/debasmitr/.pi/agent → --home-debasmitr-.pi-agent--
  const normalized = projectPath.replace(/^\//, '').replace(/\//g, '-');
  return `--${normalized}--`;
}

// Find ALL session directories, optionally filtered by project
function getSessionDirs(projectFilter) {
  if (!existsSync(SESSIONS_BASE)) return [];
  const allDirs = readdirSync(SESSIONS_BASE)
    .filter(d => statSync(join(SESSIONS_BASE, d)).isDirectory());
  
  if (projectFilter) {
    const targetDir = getSessionDirForProject(projectFilter);
    // Also include home dir sessions (they're cross-project)
    return allDirs
      .filter(d => d === targetDir || d === '--home-debasmitr--')
      .map(d => join(SESSIONS_BASE, d));
  }
  return allDirs.map(d => join(SESSIONS_BASE, d));
}

// Find session files within date range
function findSessionFiles(startMs, endMs, dirs) {
  const results = [];
  
  for (const dir of dirs) {
    const files = readdirSync(dir).filter(f => f.endsWith('.jsonl'));
    for (const file of files) {
      const match = file.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})/);
      if (!match) continue;
      
      const fileMs = Date.UTC(
        parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]),
        parseInt(match[4]), parseInt(match[5]), parseInt(match[6])
      );
      
      if (fileMs >= startMs - 86400000 && fileMs < endMs) {
        results.push({ path: join(dir, file), fileMs });
      }
    }
  }
  
  results.sort((a, b) => b.fileMs - a.fileMs);
  return results.map(r => r.path);
}

// Extract OM entries from a session file
function extractEntries(filePath, startMs, endMs) {
  const entries = [];
  const sessionId = filePath.split('/').pop()?.replace('.jsonl', '') || 'unknown';
  const lines = readFileSync(filePath, 'utf-8').split('\n').filter(l => l.trim());

  for (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    
    if (entry.type === 'custom') {
      const data = entry.data;
      const entryTime = entry.timestamp ? new Date(entry.timestamp).getTime() : 0;
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
const { startMs, endMs, startDate, endDate } = parseDateQuery(dateArg, offset);

// Check git commits first (productive day check)
const commits = getGitCommits(projectPath, startDate, endDate);
if (commits.length === 0) {
  console.log(`No commits found for "${dateArg}" in ${projectPath}`);
  console.log('Use --verbose to see session data anyway, or --project /path to specify repo.');
  if (!verbose) process.exit(0);
  console.log('\n--- Session data (no commits) ---\n');
}

// Find sessions (project-scoped)
const dirs = getSessionDirs(projectPath);
const files = findSessionFiles(startMs, endMs, dirs);
const allEntries = dedup(files.flatMap(f => extractEntries(f, startMs, endMs)));

// Output
if (commits.length > 0) {
  console.log('## Git Activity');
  commits.forEach(c => console.log(`- ${c}`));
  console.log();
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

if (allEntries.length === 0 && commits.length === 0) {
  console.log(`No activity found for "${dateArg}".`);
}
