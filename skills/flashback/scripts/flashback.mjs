#!/usr/bin/env node
// flashback: query past Pi sessions by date.
// Reads pi session JSONL files (observations/reflections written by pi-blackhole).
// Usage: node flashback.mjs [date] [keyword...] [--verbose]
//   date: yesterday | today | last N days | YYYY-MM-DD   (default: yesterday)
//   keyword: filter entries by content (space-separated, OR match)
//   --verbose: show session file path per entry
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const BASE = join(homedir(), '.pi', 'agent', 'sessions');
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const dateArg = args.find((a) => !a.startsWith('--')) || 'yesterday';
const keywords = args.filter((a) => !a.startsWith('--') && a !== dateArg);

// ── Date parsing (local time) ──────────────────────────────────────────────
function parseDate(q) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  const today = new Date(y, m, d);
  let start, end;
  if (q === 'today') { start = today; end = new Date(today.getTime() + 86400000); }
  else if (q === 'yesterday') { start = new Date(y, m, d - 1); end = today; }
  else if (/^last\s+(\d+)\s+days?$/i.test(q)) { start = new Date(y, m, d - parseInt(q.match(/(\d+)/)[1])); end = new Date(today.getTime() + 86400000); }
  else if (/^\d{4}-\d{2}-\d{2}$/.test(q)) { const [Y, M, D] = q.split('-').map(Number); start = new Date(Y, M - 1, D); end = new Date(start.getTime() + 86400000); }
  else throw new Error(`Unknown date: "${q}". Use yesterday | today | last N days | YYYY-MM-DD`);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

// ── Scan session files (filename UTC date, ±1 day margin for timezone) ─────
function findSessionFiles(startMs, endMs) {
  const out = [];
  if (!existsSync(BASE)) return out;
  for (const dir of readdirSync(BASE)) {
    const full = join(BASE, dir);
    if (!statSync(full).isDirectory()) continue;
    for (const f of readdirSync(full)) {
      if (!f.endsWith('.jsonl')) continue;
      const m = f.match(/^(\d{4})-(\d{2})-(\d{2})T/);
      if (!m) continue;
      const fileMs = Date.UTC(+m[1], +m[2] - 1, +m[3]);
      if (fileMs >= startMs - 86400000 && fileMs < endMs) out.push(join(full, f));
    }
  }
  return out.sort((a, b) => b.localeCompare(a));
}

// ── Extract observations/reflections ───────────────────────────────────────
function extractEntries(file) {
  const out = [];
  for (const line of readFileSync(file, 'utf-8').split('\n')) {
    let e; try { e = JSON.parse(line); } catch { continue; }
    if (e.type !== 'custom') continue;
    const t = e.timestamp ? new Date(e.timestamp).getTime() : 0;
    if (!t || t < startMs || t >= endMs) continue;
    if (e.customType === 'om.observations.recorded') {
      for (const o of e.data?.observations ?? []) out.push({ kind: 'observation', ts: e.timestamp, content: o.content, file });
    } else if (e.customType === 'om.reflections.recorded') {
      for (const r of e.data?.reflections ?? []) out.push({ kind: 'reflection', ts: e.timestamp, content: r.content, file });
    }
  }
  return out;
}

// ── Git commits on the day (productive-day signal) ─────────────────────────
function gitCommits(cwd, startMs) {
  try {
    const day = new Date(startMs).toISOString().split('T')[0];
    const next = new Date(startMs + 86400000).toISOString().split('T')[0];
    const log = execSync(`git log --oneline --after="${day}" --before="${next}"`, { cwd, encoding: 'utf-8', timeout: 5000 }).trim();
    return log ? log.split('\n') : [];
  } catch { return []; }
}

const { startMs, endMs } = parseDate(dateArg);
const files = findSessionFiles(startMs, endMs);
let entries = files.flatMap(extractEntries);
if (keywords.length) {
  entries = entries.filter((e) => keywords.some((k) => e.content.toLowerCase().includes(k.toLowerCase())));
}
// dedup identical content
const seen = new Set();
entries = entries.filter((e) => { const k = e.content.slice(0, 100); return seen.has(k) ? false : (seen.add(k), true); });

const dayStr = new Date(startMs).toLocaleDateString();
const commits = gitCommits(process.cwd(), startMs);

console.log(`# Flashback: ${dateArg} (${dayStr}) — ${entries.length} memories, ${commits.length} commits, ${files.length} session files`);
if (commits.length) console.log(`\n## Git commits\n${commits.join('\n')}`);
if (!entries.length) { console.log('\nNo observations/reflections found for that day.'); process.exit(0); }
console.log('\n## Memories');
for (const e of entries) {
  console.log(`- [${e.kind}] ${e.ts} ${e.content}${verbose ? `  (${e.file.split('/').pop()})` : ''}`);
}
