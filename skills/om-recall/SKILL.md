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

Run the script:

```bash
node scripts/om-recall.mjs [date] [--verbose]
```

Date formats: `yesterday`, `today`, `last 3 days`, `YYYY-MM-DD`

## Output

- **Reflections** — Durable facts (stable, long-lived)
- **Key Events** — High/critical relevance only (default)

Use `--verbose` to see all observations.

## Timezone

Set in `settings.json` under `om.timezoneOffset` (e.g., `5.5` for IST).
Override: `OM_TIMEZONE_OFFSET=5.5`
