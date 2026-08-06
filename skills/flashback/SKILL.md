---
name: flashback
description: >
  Flashback to past Pi sessions via pi-blackhole. Use when the user asks 'what did I do yesterday',
  'what happened on Monday', 'what were we working on last week', 'show me last activity',
  'what did I do on [date]', 'find discussion about [topic] on [date]', 'flashback to [date/topic]',
  or any question about past session work. Supports date-specific, topic-specific, and recent-activity queries.
compatibility: >
  Requires npm:pi-blackhole package. Uses /blackhole-memory, /blackhole-recall commands
  and the recall tool.
---

# Flashback

Travel back through your Pi session history via pi-blackhole.

## When to Use

| User asks | Command / Tool |
|---|---|
| What did I do yesterday/last? | `/blackhole-memory status` + `recall` with recent context |
| Progress / latest update | `/blackhole-memory status` → summarize findings |
| What happened on [date]? | `/blackhole-recall` with date scope, or `recall` searching by date |
| Find discussion about [topic] | `recall("<topic query>")` — BM25 search across transcript |
| Find discussion about [topic] on [date] | `recall("<topic> <date>")` with `scope:all` |
| Show all memory | `/blackhole-memory full` |
| Show visible memory | `/blackhole-memory view` |

## Quick Start

### Recent activity / last update

1. Run `/blackhole-memory status` to get pipeline state and token counts
2. Use `recall` tool with recent terms or `mode:touched` to see files worked on
3. Summarize in bullet points

### Date-specific query

1. Use `recall("<topic or date keywords>")` — searches transcript by BM25
2. Add `scope:all` to search across all session lineages
3. For file changes on a date: `recall("mode:touched")` then filter by date context

### Topic search

1. `recall("<exact terms or regex>")` — ranked search
2. `recall("<topic> scope:all")` — across all sessions
3. `recall("mode:file")` — search only file content from write/edit operations

## Output Format

Default (bullet points):
- Key decisions, actions, outcomes as bullet list
- Group by topic if multiple themes
- Include timestamps when available

Detailed (when user asks to elaborate):
- Full summary with context
- Include source entry references
- Show file changes, commits, blockers

## Commands Reference

| Command | What it does |
|---|---|
| `/blackhole` | Manual compact — deterministic structural summary |
| `/blackhole settings` | Open configuration overlay |
| `/blackhole om-off` / `om-on` | Toggle observational memory |
| `/blackhole-memory status` | Pipeline status: token progress, observation/reflection counts |
| `/blackhole-memory view` | Show visible observations and reflections |
| `/blackhole-memory full` | Show ALL recorded memory (includes dropped) |
| `/blackhole-recall <query> [page:N] [scope:all] [mode:file\|touched]` | Search session history |

## Recall Tool Inputs

| Input | What it does |
|---|---|
| `[12-char hex]` | Recover source evidence for observation/reflection ID |
| `#N` | Expand session entry by index |
| `#N:path` | Drill-down into file content from tool call |
| Free text | BM25-ranked search across transcript |
| `mode:file` | Search only write/edit file content |
| `mode:touched` | Aggregate all files written/edited, grouped by path |
| Regex | Pattern search (e.g. `fork.*auth`) |
| `scope:all` | Search across all session lineages |

## What This Skill Does NOT Do

- Does not compact sessions (use `/blackhole` directly)
- Does not modify blackhole config (use `/blackhole settings`)
- Does not replace the `recall` tool — this skill guides when/how to use it
