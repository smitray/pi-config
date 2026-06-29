---
name: kb
description: >
  Knowledge Base extension for Pi. Self-contained .kb/ vaults with wiki pages, source capture,
  template enforcement, tag-aware search, and dual-mode recall (project-first vs docs-first).
  Integrates with web-access for URL capture and gh for GitHub repo/issue/PR capture.
compatibility: >
  Requires the kb pi extension (installed at ~/.pi/agent/extensions/kb). Optional integrations:
  web-access extension for URL capture, gh extension for GitHub capture.
---

# kb — Knowledge Base

A from-scratch knowledge base extension implementing the Karpathy LLM Wiki pattern.
Stores knowledge in `.kb/` vaults with four layers: raw (immutable sources), wiki (editable
pages with wikilinks), meta (auto-generated registry and backlinks), and config (templates).

## Vault structure

```text
.kb/
├── config.json                    # topic, mode, created, version
├── templates/pages/               # 8 page templates (5 core + 3 personal)
│   ├── concept.md
│   ├── entity.md
│   ├── synthesis.md
│   ├── analysis.md
│   ├── source.md
│   ├── meeting.md                 # personal vault only
│   ├── diary.md                   # personal vault only
│   └── artifact.md                # project vault only
├── raw/sources/SRC-YYYY-MM-DD-NNN/
│   ├── manifest.json              # sourceId, type, title, status, captured
│   ├── original/                  # original file or content.txt
│   └── extracted.md               # normalized markdown for agent reading
├── wiki/
│   ├── concepts/                  # concept pages
│   ├── entities/                  # entity pages
│   ├── syntheses/                 # synthesis pages
│   ├── analyses/                  # analysis pages
│   └── sources/                   # source summary pages
└── meta/
    ├── registry.json              # all wiki pages indexed by id, title, type, tags, stage
    └── backlinks.json             # wikilink [[target]] → source page mapping
```

## Vault resolution

Vault mode is detected from cwd:

- **Project mode:** `.kb/` exists in cwd or parent, OR cwd is inside a git repo
- **Personal mode:** fallback to `~/.kb/` (or `KB_HOME` env var)

Override with `KB_MODE=project` or `KB_MODE=personal` env var.

## Tool reference

### `kb_bootstrap`

Initialize a new `.kb/` vault. Auto-detects project vs personal mode.

```text
kb_bootstrap topic="My Project"
kb_bootstrap topic="Personal KB" mode=personal root="/home/user"
```

Creates config.json, templates, raw/, wiki/, meta/. Only needed once per vault.

### `kb_ensure_page`

Create a wiki page with enforced template frontmatter. Templates are always applied.

```text
kb_ensure_page type=concept title="Async Patterns"
kb_ensure_page type=entity title="FastAPI" content="## Details\nFastAPI is..."
kb_ensure_page type=synthesis title="Auth Architecture"
kb_ensure_page type=analysis title="Performance Bottleneck"
kb_ensure_page type=source title="React Docs Summary"
```

Types: `concept`, `entity`, `synthesis`, `analysis`, `source`, `meeting`, `diary`, `artifact`.
Falls back to `concept` if type is unrecognized. Template is loaded from `.kb/templates/pages/{type}.md`.
Personal vaults get 7 templates (no `artifact`). Project vaults get all 8.

### `kb_capture`

Capture a file or text into raw/sources/ as an immutable source packet.

```text
# Capture a file
kb_capture source="/path/to/file.md" title="Architecture Doc"

# Capture raw text
kb_capture source="The key insight is..." title="Meeting Notes" type=text

# Auto-detect (file if exists, text otherwise)
kb_capture source="README.md" title="Project README"
```

For URLs, use `web-access` first, then capture the result — see Patterns below.

### `kb_ingest`

List uningested sources for the agent to process.

```text
kb_ingest
```

Returns pending sources with their `extracted.md` paths. Read each, create wiki pages with
`kb_ensure_page`, then mark ingested with `kb_mark_ingested`.

### `kb_mark_ingested`

Mark a source packet as processed. Removes it from `kb_ingest` pending lists.

```text
kb_mark_ingested sourceId="SRC-2026-06-26-001"
```

### `kb_status`

Show vault health: mode, page counts by type, pending sources, template count.

```text
kb_status
```

### `kb_recall_context`

Search both vaults, **project vault first**. Use at task start for working-memory context.

```text
kb_recall_context query="auth patterns"
kb_recall_context query="caching strategy" maxResults=10
```

### `kb_recall_docs`

Search both vaults, **personal vault first**. Use for documentation and library lookups.

```text
kb_recall_docs query="React useEffect"
kb_recall_docs query="FastAPI dependency injection" maxResults=10
```

### `kb_search_tags`

Search wiki pages by frontmatter tags, page type, or workflow stage.

```text
kb_search_tags tag="react"
kb_search_tags type="concept"
kb_search_tags stage="production"
kb_search_tags tag="python" type="entity" stage="draft"
```

Stages: `brainstorm` (default for new pages), `draft`, `review`, `production`.

### `om_recall`

Query observational memory by date. Reads OM session data to answer "what did I do yesterday".

```text
om_recall date="yesterday"
om_recall date="today"
om_recall date="2026-06-25"
om_recall date="last 3 days"
```

Returns observations (events & decisions) and reflections (durable facts) from previous Pi
sessions. Works by reading session JSONL files and extracting `om.observations.recorded`,
`om.reflections.recorded`, and `om.folded` entries.

Note: Only works with sessions that were compacted (OM folds memory into compaction details).
Non-compacted sessions may have incomplete data.

## Hooks (automatic behavior)

| Hook | When | What |
|------|------|------|
| `session_start` | Pi session starts | Shows vault status in UI if vault exists |
| `before_agent_start` | Before each agent turn | Injects KB context into system prompt IF prompt contains knowledge keywords (architecture, design, api, etc.) |
| `tool_result` | After kb tool writes | Rebuilds metadata (registry + backlinks) after `kb_ensure_page` or `kb_capture` |
| `tool_call` | Before write/edit | Blocks writes to `.kb/raw/` and `.kb/meta/` (immutable) |

## Page templates

All 5 templates enforce frontmatter with these fields:

```yaml
---
title: "{{title}}"
type: concept|entity|synthesis|analysis|source
tags: []
created: "{{created}}"
updated: "{{updated}}"
stage: brainstorm
sources: []
---
```

Templates are written to `.kb/templates/pages/` on bootstrap. Edit them to customize page
structure for your workflow.

## Cross-extension workflows

### URL capture (uses web-access)

```text
# 1. Fetch the URL as markdown
web-fetch url="https://example.com/docs/api"

# 2. Save the fetched content to a temp file
# (web-fetch returns markdown in the response)

# 3. Capture into KB
kb_capture source="/tmp/fetched-content.md" title="Example API Docs"

# 4. Ingest
kb_ingest
# → read extracted.md, create wiki pages with kb_ensure_page
kb_mark_ingested sourceId="SRC-..."
```

For multi-page docs sites, use `web-fetch-docs` first, then capture individual pages:

```text
web-fetch-docs baseUrl="https://docs.example.com" label=example-docs depth=3
docs-pages label=example-docs
# → capture each page with kb_capture
```

### GitHub repo/issue capture (uses gh)

```text
# 1. Get repo info
gh-repo-view owner="vercel" repo="next.js"

# 2. Capture repo description as entity
kb_ensure_page type=entity title="Next.js" content="Repo: vercel/next.js\n\n..."

# 3. For issues/PRs
gh-issue-view owner="vercel" repo="next.js" number=12345
kb_capture source="<issue content>" title="Next.js Issue #12345" type=text
```

### Session context injection

The `before_agent_start` hook automatically injects relevant KB context when your prompt
contains knowledge-related keywords (architecture, design, api, library, framework, etc.).

No manual action needed — just ask knowledge-related questions and the KB context appears
in the system prompt.

## Patterns

### Pattern: bootstrap a project KB

```text
kb_bootstrap topic="My Awesome Project"
kb_capture source="README.md" title="Project README"
kb_ingest
# → read extracted.md, create wiki pages
```

### Pattern: daily knowledge capture

```text
# Capture a meeting note
kb_capture source="Discussion about auth strategy. Decided: JWT with refresh tokens." title="Auth Decision Meeting" type=text

# Create wiki page from it
kb_ensure_page type=concept title="Auth Strategy" content="From meeting: JWT with refresh tokens..."
kb_mark_ingested sourceId="SRC-2026-06-26-001"
```

### Pattern: research and synthesize

```text
# 1. Search and capture sources
web-search query="React Server Components patterns"
web-fetch url="<best result>"
kb_capture source="<fetched content>" title="RSC Patterns"

# 2. Ingest and create wiki pages
kb_ingest
kb_ensure_page type=concept title="React Server Components"
kb_ensure_page type=synthesis title="RSC vs CSR Trade-offs"
kb_mark_ingested sourceId="SRC-..."

# 3. Link pages with wikilinks in content
kb_ensure_page type=analysis title="Frontend Architecture Decision"
# content: "See [[React Server Components]] and [[RSC vs CSR Trade-offs]]"
```

### Pattern: recall at task start

```text
# Context mode (project first) — automatic, or manual:
kb_recall_context query="current architecture decisions"

# Docs mode (personal first) — for library lookups:
kb_recall_docs query="FastAPI WebSocket support"
```

### Pattern: tag-based navigation

```text
# Find all production-ready pages
kb_search_tags stage=production

# Find all Python-related concepts
kb_search_tags tag=python type=concept

# Find all entity pages
kb_search_tags type=entity
```

## Guardrails

- `.kb/raw/` is immutable — no writes or edits allowed
- `.kb/meta/` is auto-generated — no manual edits
- `.kb/wiki/` is the only editable directory
- Guardrails apply per-vault, resolved from current working directory

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `KB_MODE` | auto-detect | Override vault mode: `project` or `personal` |
| `KB_HOME` | `~/.kb/` | Override personal vault location |

## Settings (in pi settings.json)

```json
{
  "kb": {
    "taskModel": "deepseek/deepseek-v4-pro",
    "recallLinksThreshold": 50,
    "autoIngest": false
  }
}
```

## What this extension does NOT do

- **Session logging.** Use `pi-observational-memory` (OM) for session continuity and memory.
- **Embeddings.** Search uses token-overlap scoring on titles and tags. Upgrade to embeddings
  when vault hits 1000+ pages.
- **Git integration.** Use `gh` extension tools for GitHub operations.
- **URL fetching.** Use `web-access` extension tools for web content.
