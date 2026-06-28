---
name: om-recall
description: "Query observational memory from previous Pi sessions by date. Use when the user asks 'what did I do yesterday', 'what happened on Monday', 'what were we working on last week', or any question about past session activity."
---

# OM Recall

## When to Use

- "What did I do yesterday?"
- "What happened on Monday?"
- "What were we working on last week?"

## Tool

**om_recall(date: string, verbose?: boolean)**

Date formats: `yesterday`, `today`, `last 3 days`, `YYYY-MM-DD`

## Output

- **Reflections** — Durable facts (stable, long-lived)
- **Key Events** — High/critical relevance observations only (filtered by default)

## Timezone

Configured in `settings.json` under `om.timezoneOffset`:

```json
{
  "om": {
    "timezoneOffset": 5.5
  }
}
```

Override with env var: `OM_TIMEZONE_OFFSET=5.5`

## Troubleshooting

**"No observational memory found"** — Session wasn't compacted yet (~80K tokens threshold).

**Wrong day's results** — Check `om.timezoneOffset` in settings.json matches your UTC offset.

**Too many results** — Use `verbose: true` to see all observations.
