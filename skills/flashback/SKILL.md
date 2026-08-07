---
name: flashback
description: >
  Search past Pi sessions by date via scripts/flashback.mjs — reads pi session
  JSONL files (observations/reflections written by pi-blackhole) plus git commits.
  Use when the user asks 'what did I do yesterday', 'what happened on Monday',
  'what were we working on last week', 'show me last activity', 'what did I do
  on [date]', 'find discussion about [topic] on [date]', 'flashback to [date/topic]',
  or any question about PAST session work. Does not help with the current session.
compatibility: >
  Reads ~/.pi/agent/sessions/**/*.jsonl (pi-blackhole om.observations.recorded /
  om.reflections.recorded entries). git required for commit summaries. Node >= 18.
---

# Flashback

Answer "what did I do [when]" from past Pi sessions. Reads durable
observations/reflections blackhole wrote into session files, filtered by date.

## When to Use

| User asks | Run |
|---|---|
| What did I do yesterday? | `node scripts/flashback.mjs yesterday` |
| What happened on [date]? | `node scripts/flashback.mjs YYYY-MM-DD` |
| Last week / last N days | `node scripts/flashback.mjs "last 7 days"` |
| Discussion about [topic] on [date] | `node scripts/flashback.mjs YYYY-MM-DD <topic>` |
| Show me last activity | `node scripts/flashback.mjs today` |

Run from the skill dir (`~/.pi/agent/skills/flashback/`), then summarize the
output as bullets — group by theme, keep timestamps.

## Usage

```text
node scripts/flashback.mjs [date] [keyword...] [--verbose]
```

| Arg | Meaning |
|---|---|
| `yesterday` (default) | Previous local day |
| `today` / `last N days` | Same day / trailing window |
| `YYYY-MM-DD` | Specific day |
| `keyword...` | OR-filter on memory content (e.g. `kb`, `auth bug`) |
| `--verbose` | Show source session file per memory |

Output: header with counts, git commits for that day (productive-day signal),
then `[observation]`/`[reflection]` entries with timestamps.

## Error Handling

| Symptom | Response |
|---|---|
| `Unknown date: "..."` | Use yesterday / today / last N days / YYYY-MM-DD only |
| `No observations/reflections found` | Day has no OM entries (pre-blackhole sessions or idle day). Report git commits + session file count; try wider window or `last N days` |
| `ENOENT ... sessions` | `~/.pi/agent/sessions/` missing — pi session storage moved or not initialized |
| `0 session files` | Date range has no session files — verify date, try `last 7 days` |
| Exit non-zero, script missing | Reinstall skill from git; verify `scripts/flashback.mjs` exists |

## What This Skill Does NOT Do

- Does NOT search the current session — use the `recall` tool for live transcript
- Does not compact sessions (use `/blackhole`)
- Does not modify blackhole config (use `/blackhole settings`)
- Does not search file content — memories are distilled observations/reflections only

## Related

- `recall` tool — current-session history (complement: flashback = past sessions)
- `/blackhole-memory` — live pipeline status for the current session
