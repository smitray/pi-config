---
name: kb-update
description: >
  Update existing KB pages when new information is discovered during discussion. Use when the
  user reveals new details about a topic already in the KB — observe, review, integrate.
---

# kb-update

Semi-automatic enrichment: detect when new info relates to existing KB pages, capture it,
get user approval, merge.

## When to Use

During any discussion, when new information matches an existing KB topic:

1. User mentions something that sounds like it's already in KB
2. A new insight contradicts or extends a KB page
3. A decision is made that updates a KB-tracked topic

## Workflow

### Step 1: Detect

Check if topic already exists:

```text
kb_recall_context query="<topic>"
```

If 0 results → topic is new, use `kb-research` skill instead.
If results found → proceed to step 2.

### Step 2: Observe

Capture the new info as an observation:

```text
kb_observe title="<topic> update"
           content="<new insight>"
           relevance=high
           tags=["<topic-tag>"]
           sourceContext="Discovered during discussion about <context>"
```

Relevance levels: `low` (minor detail), `medium` (useful context), `high` (significant insight), `critical` (breaking change).

### Step 3: Integrate (Inline Approval)

Use `kb_enrich` — it automatically presents inline approval options:

```text
kb_enrich pageTitle="<existing page>"
           observationTitle="<observation title>"
           observationContent="<new info>"
           sourceContext="<context>"
```

**What happens next**: kb_enrich presents UI options (if available):
- **Merge** → integrates observation into the page
- **Observe** → saves as separate observation
- **Discard** → does nothing

No separate `ask_user_question` call needed — the approval is built into kb_enrich.

If no UI available (e.g., in script mode), kb_enrich defaults to merge.

### Step 4: Verify

```text
kb_recall_context query="<topic>"     # verify page is updated
kb_lint staleDays=30                   # check nothing broke
```

## Best Practices

- **Don't spam observations.** Only capture info that genuinely adds to existing KB knowledge.
- **Use high relevance for decisions.** "We chose JWT over sessions" = high. "JWT also supports RS256" = medium.
- **Preserve observations as audit trail.** Integration doesn't delete observations — they stay in `wiki/sources/` with `status: observation`.
- **When in doubt, observe.** Better to capture and discard later than lose an insight.
