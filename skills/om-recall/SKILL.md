---
name: om-recall
description: >
  Query observational memory from previous Pi sessions by date. Use when the user asks
  "what did I do yesterday", "what happened on Monday", "what were we working on last week",
  or any question about past session activity. Returns timestamped observations and
  durable reflections from compacted session memory.
---

# OM Recall — Session Memory

Query observational memory from previous Pi sessions.

## When to Use

- "What did I do yesterday?"
- "What happened on Monday?"
- "What were we working on last week?"
- "Continue where we left off"

## Tool

**om_recall** — Query by date

```
om_recall(date: "yesterday")
om_recall(date: "2026-06-28")
om_recall(date: "last 3 days")
```

## Date Formats

| Input | Meaning |
|-------|---------|
| `yesterday` | Previous calendar day (local timezone) |
| `today` | Current calendar day |
| `last 3 days` | Rolling window including today |
| `YYYY-MM-DD` | Specific date |

## Output

Returns two sections:

**Reflections** — Durable facts distilled from observations (stable, long-lived)

**Observations** — Timestamped events from conversation history (chronological)

## Limitations

- Relies on OM compaction — if a session wasn't compacted, it won't appear
- Cross-project: shows all sessions, not filtered by vault
- No semantic search: date-based only

## vs KB Recall

| Feature | om_recall | kb_recall_* |
|---------|-----------|-------------|
| Scope | Session history | Knowledge base |
| Source | OM compactions | Wiki pages |
| Query | Date | Keywords/semantic |
| Use case | "What did I do?" | "What do I know about X?" |

## Troubleshooting

**"No observational memory found"**
- Session wasn't compacted yet (OM compacts after ~80K tokens)
- Wrong date — check if your timezone matches OM timestamps (UTC)

**Too many results**
- OM dumps all entries for that date
- Focus on reflections first (they're the durable facts)
