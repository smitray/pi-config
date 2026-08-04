---
name: om-recall
description: >
  Query observational memory from previous Pi sessions by date. Use when the user asks
  'what did I do yesterday', 'what happened on Monday', 'what were we working on last week',
  or any question about past session activity. Part of the pi-observational-memory package.
---

# OM Recall

Access session history via the observational-memory package. No script needed — these are built-in commands/tools.

## Commands (slash)

| Command | What it does |
|---|---|
| `/om:status` | Current OM status: branch, turn count, events |
| `/om:view` | Summarized observations for current day |
| `/om:view full` | All observations (includes low-relevance) |
| `/om:view --date YYYY-MM-DD` | Observations for specific day |
| `/om:view --project /path` | Scoped to a project directory |

## Tool

```text
recall(<12-char-hex-id>)   # recover exact source context behind an observation/reflection
```

Use when you need verbatim content from a remembered claim, not just the summary.

## Timezone

Configured in `settings.json` under `observational-memory.timezoneOffset`.
Override: `OM_TIMEZONE_OFFSET=5.5`

## Pattern

User: "What did we work on Monday?" → `/om:view --date 2026-08-03`
User: recalls an ID from a prior session → `recall(abc123def456)`
User: "Show me current OM status" → `/om:status`
