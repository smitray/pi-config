# Knowledge Base — Agent Instructions

This KB is maintained by your coding agent. Read this file first.

## Quick Workflows

Use these skills for common tasks (rather than calling tools manually):

- `kb-research` — "research X and save to KB"
- `kb-capture-url` — "capture this URL"
- `kb-bootstrap` — "create a KB for this project"
- `kb-update` — "update the KB with this new info"

Otherwise, the tools are listed below.

## Directory Layout

```
.kb/
├── raw/sources/     # Immutable source packets — never modify
├── wiki/            # Agent-owned wiki pages
│   ├── sources/     # Source summaries
│   ├── entities/    # Tools, people, projects, products
│   ├── concepts/    # Ideas, frameworks, methods
│   ├── syntheses/   # Multi-source summaries
│   ├── analyses/    # Comparisons, decisions
│   ├── artifacts/   # WIP, brainstorming (project vault only)
│   ├── meetings/    # Meeting notes (personal vault only)
│   └── diaries/     # Daily logs (personal vault only)
├── meta/            # Auto-generated registry, backlinks, embeddings, events
└── templates/       # Page templates
```

## Page Format

Every page uses frontmatter:

```yaml
---
title: "Page Title"
type: concept | entity | synthesis | analysis | source | artifact | meeting | diary
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

After kb_capture the tool_result hook auto-ingests (if `autoIngest` enabled) and rebuilds metadata.

## Search Workflow

- `kb_recall_context` — project-first search, hybrid (lexical + semantic embeddings when enabled)
- `kb_recall_docs` — personal-first search, same hybrid behavior
- `kb_search_tags` — filter by tag, type, or stage
- `kb_lint` — health check (orphans, broken links, empty, stale pages)

## Naming Conventions

- Source slugs: kebab-case matching filename
- Entity pages: TitleCase (e.g. `FastAPI.md`, `OpenAI.md`)
- Concept pages: TitleCase (e.g. `RAG.md`, `AsyncPatterns.md`)

## Tools

| Tool | Purpose |
|------|---------|
| `kb_bootstrap` | Initialize vault (auto-detects project vs personal) |
| `kb_ensure_page` | Create or update wiki page with template-enforced frontmatter |
| `kb_capture` | Capture file/text into `raw/sources/` as immutable packet |
| `kb_ingest` | List pending sources |
| `kb_mark_ingested` | Mark source as processed |
| `kb_status` | Vault health overview |
| `kb_recall_context` | Search wiki (project vault first) |
| `kb_recall_docs` | Search wiki (personal vault first) |
| `kb_search_tags` | Filter by tag/type/stage |
| `kb_rebuild_meta` | Manually rebuild registry + backlinks |
| `kb_lint` | Wiki health checks (orphans, broken links, empty, stale) |
| `kb_observe` | Mid-session observation capture |
| `kb_enrich` | Merge observation into existing wiki page (with user approval) |
| `kb_retro` | Atomic insight capture (single markdown file) |
| `kb_log_event` | Append event to `meta/events.jsonl` audit trail |

## Page Templates

Source of truth: `extensions/kb/templates/pages/` (copied to `.kb/templates/pages/` on bootstrap).

Edit templates in the extension to update all future KBs. Existing KBs keep their local copy.

- **concept** — Definition, Key Points, Related Concepts, Open Questions
- **entity** — Overview, Details, Related Entities
- **synthesis** — Thesis, Evidence, Contradictions, Open Questions
- **analysis** — Question, Answer, Reasoning, Sources
- **source** — Summary, Key Entities, Key Concepts, Notes
- **meeting** — Goal, Key Discussions, Decisions Made, Action Items (personal)
- **diary** — Event Summary, Key Decisions, Energy & Mood, Connections (personal)
- **artifact** — Problem Statement, Research, Ideas, Tasks, Implementation, Testing, Notes (project)

## Guardrails

- `.kb/raw/` and `.kb/meta/` are blocked from writes
- Only `.kb/wiki/` is editable
- Toggle via `/guardrails on|off`
