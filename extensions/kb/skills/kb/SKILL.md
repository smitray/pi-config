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
kb_bootstrap topic="My Project"                          # Initialize vault
kb_capture source="README.md" title="Project README"     # Capture a source
kb_ingest                                                # List pending sources
kb_ensure_page type=concept title="Architecture Overview"# Create wiki page
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
| Project | `.kb/` in repo | 8 types | No |
| Personal | `~/.kb/` | 7 types | Yes |

Auto-detected from cwd/git repo status. Override: `KB_MODE=project|personal`.

## Page Types

| Type | Purpose | Section Count |
|---|---|---|
| `concept` | Ideas, patterns, techniques | Template-driven |
| `entity` | Concrete things (libraries, tools) | Template-driven |
| `synthesis` | Combined insight from multiple sources | Template-driven |
| `analysis` | Comparison, evaluation, trade-offs | Template-driven |
| `source` | Summary of captured source | Template-driven |
| `artifact` | WIP, brainstorming, planning (project only) | Template-driven |
| `meeting` | Meeting notes (personal only) | Template-driven |
| `diary` | Daily log (personal only) | Template-driven |

See [full reference](references/tool-reference.md) for all 15 tools and their parameters.

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
