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

OM stores timestamps in UTC. If you're in IST (UTC+5:30), set:

```
OM_TIMEZONE_OFFSET=5.5
```

Add to your shell profile (`~/.bashrc`, `~/.zshrc`) or Pi's environment.

## Troubleshooting

**"No observational memory found"** — Session wasn't compacted yet (~80K tokens threshold) or timezone mismatch.

**Wrong day's results** — Set `OM_TIMEZONE_OFFSET` to your UTC offset (e.g., `5.5` for IST, `-8` for PST).

**Too many results** — By default only high/critical relevance shown. Use `verbose: true` for all.
