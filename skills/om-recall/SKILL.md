---
name: om-recall
description: "Query observational memory from previous Pi sessions by date. Use when the user asks 'what did I do yesterday', 'what happened on Monday', 'what were we working on last week', or any question about past session activity."
---

# OM Recall

## When to Use

- "What did I do yesterday?"
- "What happened on Monday?"
- "What were we working on last week?"

## Usage

```bash
node scripts/om-recall.mjs [date] [--verbose] [--project /path/to/repo]
```

Date formats: `yesterday`, `today`, `last 3 days`, `YYYY-MM-DD`

## Behavior

**Productive days only**: Shows git commits first. If no commits, exits early (use `--verbose` to see session data anyway).

**Project-scoped**: Filters sessions by workspace directory. Use `--project` to specify repo (defaults to cwd).

## Output

- **Git Activity** — commits for that day
- **Reflections** — durable facts from OM
- **Key Events** — high/critical relevance observations (filtered by default)

Use `--verbose` to see all observations.

## Timezone

Set in `settings.json` under `observational-memory.timezoneOffset` (e.g., `5.5` for IST).
Override: `OM_TIMEZONE_OFFSET=5.5`
