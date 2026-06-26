# Knowledge Base — Agent Instructions

This KB is maintained by your coding agent. Read this file first.

## Quick Commands

- `ingest <file>` → capture source, create wiki pages
- `query: <question>` → search wiki, synthesize answer
- `health` → structural checks (fast, no LLM calls)
- `lint` → content quality checks (uses LLM)

## Directory Layout

```
.kb/
├── raw/sources/     # Immutable source packets — never modify
├── wiki/            # Agent-owned wiki pages
│   ├── sources/     # One summary per source document
│   ├── entities/    # Tools, people, projects, products
│   ├── concepts/    # Ideas, frameworks, methods
│   ├── syntheses/   # Saved query answers
│   └── analyses/    # Decision records
├── meta/            # Auto-generated registry + backlinks
└── templates/       # Page templates
```

## Page Format

Every page uses frontmatter:

```yaml
---
title: "Page Title"
type: source | entity | concept | synthesis | analysis
tags: []
stage: brainstorm | draft | review | production
sources: []
---
```

Use `[[PageName]]` wikilinks to cross-reference.

## Ingest Workflow

1. Read the source document fully
2. `kb_capture` the file
3. Read `extracted.md` from the source packet
4. Create wiki pages with `kb_ensure_page`
5. Mark ingested with `kb_mark_ingested`

## Query Workflow

1. `kb_recall_context` or `kb_search_tags` to find pages
2. Read relevant pages
3. Synthesize answer with `[[wikilinks]]`
4. Optionally save as synthesis page

## Naming Conventions

- Source slugs: kebab-case matching filename
- Entity pages: TitleCase (e.g. `FastAPI.md`, `OpenAI.md`)
- Concept pages: TitleCase (e.g. `RAG.md`, `AsyncPatterns.md`)

## Tools

| Tool | Purpose |
|------|---------|
| `kb_bootstrap` | Initialize vault |
| `kb_capture` | Capture file/text into raw/ |
| `kb_ingest` | List pending sources |
| `kb_ensure_page` | Create wiki page |
| `kb_mark_ingested` | Mark source processed |
| `kb_status` | Vault health |
| `kb_recall_context` | Search (project first) |
| `kb_recall_docs` | Search (docs first) |
| `kb_search_tags` | Search by tag/type/stage |

## Page Templates

Source of truth: `extensions/kb/templates/pages/` (copied to `.kb/templates/pages/` on bootstrap).

Edit templates in the extension to update all future KBs. Existing KBs keep their local copy.

- **concept** — Definition, Key Points, Related Concepts, Open Questions
- **entity** — Overview, Details, Related Entities
- **synthesis** — Thesis, Evidence, Contradictions, Open Questions
- **analysis** — Question, Answer, Reasoning, Sources
- **source** — Summary, Key Entities, Key Concepts, Notes
- **meeting** — Goal, Key Discussions, Decisions Made, Action Items
- **diary** — Event Summary, Key Decisions, Energy & Mood, Connections
- **artifact** — Purpose, Usage, Code, Dependencies
