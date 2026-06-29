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

### Step 3: Review

Ask user for approval:

```text
ask_user_question questions=[{
  question: "Update the existing KB page '<page title>' with this new info?",
  header: "KB Update",
  options: [
    { label: "Yes, update page", description: "Merge into canonical page" },
    { label: "Save as observation", description: "Keep as separate observation" },
    { label: "Discard", description: "Not relevant enough" }
  ]
}]
```

### Step 4: Integrate

If user approves:

```text
kb_enrich pageTitle="<existing page>"
           observationTitle="<observation title>"
           observationContent="<new info>"
           sourceContext="<context>"
```

The tool merges observation content into the appropriate section of the existing page. Falls back to simple append if model is unavailable.

### Step 5: Verify

```text
kb_recall_context query="<topic>"     # verify page is updated
kb_lint staleDays=30                   # check nothing broke
```

## Best Practices

- **Don't spam observations.** Only capture info that genuinely adds to existing KB knowledge.
- **Use high relevance for decisions.** "We chose JWT over sessions" = high. "JWT also supports RS256" = medium.
- **Preserve observations as audit trail.** Integration doesn't delete observations — they stay in `wiki/sources/` with `status: observation`.
- **When in doubt, observe.** Better to capture and discard later than lose an insight.
