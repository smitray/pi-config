---
name: kb
description: >
  Knowledge Base extension for Pi. Self-contained .kb/ vaults with wiki pages, source capture,
  template enforcement, tag-aware search, dual-mode recall, automated linting, AI-powered
  enrichment, embeddings + hybrid search. Use when managing project or personal knowledge bases,
  capturing sources, creating wiki pages, searching KB content, or enriching existing pages.
compatibility: >
  Requires the kb pi extension (~/.pi/agent/extensions/kb). Optional: web-access for URL capture,
  gh for GitHub capture. Workflow skills compose these tools for common tasks.
---

# kb — Knowledge Base

## Quick Start

```text
kb_scaffold topic="My Project" mode=project          # Full bootstrap (vault, roles, flow skill, ADR)
kb_capture source="README.md" title="Project README" # Capture a source
kb_ingest                                                # List pending sources
kb_ensure_page type=concept title="Architecture Overview"# Create wiki page
kb_flow action=start flow=build project=PROJ-001        # Walk a flow, handoffs per stage
kb_recall_context query="auth patterns"                  # Search project-first
kb_lint staleDays=30                                     # Health check
```

## Core Workflow

Capture → Ingest → Page → Search is the primary cycle:

1. **Capture** a file or text: `kb_capture source=<path> title=<title>`
2. **Ingest** pending sources: `kb_ingest` (reads extracted.md)
3. **Create pages**: `kb_ensure_page type=<type> title=<title>`
4. **Mark done**: `kb_mark_ingested sourceId=<SRC-xxx>`
5. **Search**: `kb_recall_context` (project-first) or `kb_recall_docs` (personal-first)

For common workflows, see [workflow guide](references/workflow-guide.md).

## Vault Types

| Mode | Location | Templates | AGENTS.md |
|---|---|---|---|
| Project | `.kb/` in repo | 16 types | Yes (via kb_scaffold) |
| Personal | `~/.kb/` | 15 types | No |

Auto-detected from cwd/git repo status. Override: `KB_MODE=project|personal`.

## Page Types (16)

| Type | Dir | ID |
|---|---|---|
| `concept` | concepts/ | — |
| `entity` | entities/ | — |
| `synthesis` | syntheses/ | — |
| `analysis` | analyses/ | — |
| `source` | sources/ | — |
| `research` | research/ | `RES-` |
| `context` | context/ | — |
| `adr` | adrs/ | `ADR-` |
| `handoff` | handoffs/ | `HOFF-` |
| `project` | projects/ | `PROJ-` |
| `library-doc` | libraries/ | `LIB-` |
| `daily-log` | dailies/ | `DAY-` |
| `brainstorm` | brainstorms/ | `BR-` |
| `sprint-plan` | plans/ | `SP-` |
| `spec` | specs/ | `SPEC-` |
| `task` | tasks/ | `TASK-` |

## Flows

`kb_flow` walks 12 named flows; every stage emits a handoff. Start → advance → loop_back (on failure) → complete. Review chains with `kb_get_handoff_chain`. See `skills/kb-flow/` for the router skill.

## Roles

Role pages live in `wiki/agents/` (entity type). `kb_role_install role=<name>` manages skill bundles; `kb_role_list` shows install status.

See [full reference](references/tool-reference.md) for all 29 tools and their parameters.

## Maintenance

```text
kb_lint staleDays=30          # Check for orphans, broken wikilinks, empty pages
kb_rebuild_meta               # Force metadata rebuild (registry + backlinks)
kb_status                     # Overview: mode, counts, pending sources
```

## Settings

Key config keys in `settings.json`:

| Key | Default | Description |
|---|---|---|
| `kb.autoIngest` | `true` | Auto-ingest after capture |
| `kb.autoLint` | `true` | Auto-lint on page creation |
| `kb.embeddings.enabled` | `false` | Enable semantic search |
| `kb.recall.linksThreshold` | `50` | Min backlinks to include in recall context |
| `kb.lint.staleDays` | `30` | Days before page considered stale |

Full settings schema: [reference/settings-schema.md](references/settings-schema.md).

## Guardrails

- `.kb/raw/` — immutable sources (blocked)
- `.kb/meta/` — auto-generated (blocked)
- `.kb/wiki/` — editable

Enforced via guardrails extension `registerRules()` API.

## Cross-Extension Integration

- **guardrails**: Dynamic rule registration for immutability
- **web-access**: URL capture via `web-fetch`, docs persistence via `web-fetch-docs`
- **gh**: GitHub URL routing (repos, issues, PRs)

## What This Extension Does NOT Do

- Not a replacement for Git-versioned documentation. KB is for discovery-phase, ephemeral knowledge.
- Not a codebase index. Use ctags/ast-grep for code structure.
- Full tool parameter reference: [tool-reference.md](references/tool-reference.md)
