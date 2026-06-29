---
name: kb-research
description: >
  Research a topic on the web and save findings to the Knowledge Base. Use when the user says
  "research X and save to KB", "look up Y and add it", "find info about Z for the knowledge base",
  or any prompt that combines web research with KB persistence.
compatibility: >
  Requires both the kb extension and the web-access extension. For GitHub-specific research use
  kb-capture-url instead.
---

# kb-research

Research a topic, capture web sources, create wiki pages — all in one flow.

## Workflow

```
1. web-search(query)           → ranked results
2. web-fetch(best 1-3 URLs)    → markdown content
3. kb_capture(each, vault)     → source packets
4. kb_ingest vault=personal    → list pending
5. kb_ensure_page(type, title) → wiki pages
6. kb_mark_ingested vault=personal each → done
```

For docs sites with kbRoot: `web-fetch-docs kbRoot=...` writes source packets directly, then `kb_ingest vault=personal`.

## Vault Routing

| Content | Vault | Rule |
|---------|-------|------|
| Library docs, tech references | `personal` | Reusable across projects |
| Project-specific research | `project` | Scoped to current work |
| Ambiguous | Ask user | `ask_user_question` |

## Step-by-Step

### 1. Search
```text
web-search query="react server components patterns" limit=3
```

### 2. Fetch top results
```text
web-fetch url="<result.url>"
```

### 3. Capture each to KB
```text
kb_capture source="<fetched markdown>" title="<page title>" vault=personal
```

**Auto-detect vault:** library/tech docs → `personal`, project-specific → `project`.

### 4. Ingest all pending
```text
kb_ingest
```

Read each source's `extracted.md`, create the right page type:
- Reference/technology → `entity`
- Pattern/technique → `concept`
- Comparison/evaluation → `analysis`
- Multi-source summary → `synthesis`

### 5. Create pages
```text
kb_ensure_page type=concept title="React Server Components"
kb_ensure_page type=analysis title="RSC vs CSR Performance"
```

### 6. Mark done
```text
kb_mark_ingested sourceId="SRC-..."
```

## Batch Pattern

When researching multiple related topics, batch at step 3: capture all sources first, then `kb_ingest` once, create all pages, mark all ingested. Don't interleave.

## Vault Rule of Thumb

```text
Library docs → personal (~/.kb/)     # React, Pinia, Hyprland, Zellij, etc.
Project work → project (.kb/)        # architecture decisions, WIP analysis
When unsure → ask_user_question      # let user decide
```
