---
name: kb
description: >
  Knowledge Base extension for Pi. Self-contained .kb/ vaults with wiki pages, source capture,
  template enforcement, tag-aware search, dual-mode recall, automated linting, AI-powered
  enrichment, embeddings + hybrid search, and cross-extension integration with web-access and gh.
compatibility: >
  Requires the kb pi extension (~/.pi/agent/extensions/kb). Optional: web-access extension for
  URL capture, gh extension for GitHub capture. Use workflow skills (kb-research, kb-capture-url,
  kb-bootstrap, kb-update) for common tasks — this file is the full tool reference.
---

# kb — Knowledge Base

Self-contained `.kb/` vaults. Four layers: **raw** (immutable sources), **wiki** (editable
pages with wikilinks), **meta** (auto-generated registry + backlinks + embeddings), and
**config** (templates + AGENTS.md).

## Workflow Skills (Use These First)

For common tasks, use the workflow skills — they compose multiple tools across extensions:

| Skill | Trigger | What It Does |
|-------|---------|--------------|
| `kb-research` | "research X and save to KB" | web-search → web-fetch → kb_capture → kb_ingest → kb_ensure_page |
| `kb-capture-url` | "capture this URL" | Auto-routes GitHub → gh tools, docs → web-fetch-docs, YouTube → media-transcribe |
| `kb-bootstrap` | "create a KB for this project" | Detect mode → kb_bootstrap → seed with README |
| `kb-update` | "update the KB with this" | kb_recall_context → kb_observe → ask_user_question → kb_enrich |

This file documents all 14 KB tools individually. Use this as reference, not as workflow
instructions.

## Vault Structure

```text
.kb/
├── config.json                    # topic, mode, created, version
├── AGENTS.md                      # KB usage instructions
├── templates/pages/               # 8 page templates
│   ├── concept.md                 #   abstract idea, pattern, technique
│   ├── entity.md                  #   concrete thing (library, tool, person, project)
│   ├── synthesis.md               #   combined insight from multiple sources
│   ├── analysis.md                #   comparison, evaluation, trade-off
│   ├── source.md                  #   summary of a captured source
│   ├── meeting.md                 #   personal vault only — meeting notes
│   ├── diary.md                   #   personal vault only — daily log
│   └── artifact.md                #   project vault only — WIP, brainstorming, planning
├── raw/sources/SRC-YYYY-MM-DD-NNN/
│   ├── manifest.json              # sourceId, type, title, status, captured
│   ├── original/                  # original file or content.txt
│   └── extracted.md               # normalized markdown for agent reading
├── wiki/
│   ├── concepts/                  # concept pages
│   ├── entities/                  # entity pages
│   ├── syntheses/                 # synthesis pages
│   ├── analyses/                  # analysis pages
│   ├── sources/                   # source summary pages
│   ├── artifacts/                 # project vault: WIP and planning
│   ├── meetings/                  # personal vault: meeting notes
│   └── diaries/                   # personal vault: daily logs
└── meta/
    ├── registry.json              # all wiki pages: id, title, type, tags, stage, backlinks
    ├── backlinks.json             # wikilink [[target]] → source page mapping
    ├── embeddings.json            # page embeddings for hybrid search
    └── events.jsonl               # audit trail (kb_log_event)
```

## Vault Resolution

- **Project mode:** `.kb/` exists in cwd/parent, or cwd inside a git repo → creates `.kb/` in cwd
- **Personal mode:** fallback → `~/.kb/` (or `KB_HOME` env var)
- Override: `KB_MODE=project` or `KB_MODE=personal`

## Tools (14 total)

### Lifecycle

#### `kb_bootstrap`
Initialize a new vault. Auto-detects mode unless overridden.

```text
kb_bootstrap topic="My Project"
kb_bootstrap topic="Personal KB" mode=personal root="/home/user"
```

Non-destructive — won't overwrite existing vaults. Personal vaults get 7 templates (no artifact).
Project vaults get all 8.

#### `kb_status`
Vault health overview: mode, page counts by type, pending sources, template count.

```text
kb_status
```

### Capture & Ingest

#### `kb_capture`
Capture file or text into `raw/sources/` as an immutable source packet.

```text
kb_capture source="/path/to/file.md" title="Architecture Doc"
kb_capture source="raw text here" title="Meeting Notes" type=text
kb_capture source="README.md" title="Project README"    # auto-detect
```

Parameters: `source` (path or text), `title` (required), `type` (auto|file|text), `vault` (auto|personal|project).
After capture, `tool_result` hook auto-ingests and auto-lints (if enabled).

#### `kb_ingest`
List uningested sources for processing.

```text
kb_ingest
```

Returns pending sources with `extracted.md` paths. Read each, create wiki pages, mark ingested.

#### `kb_mark_ingested`
Mark a source as processed.

```text
kb_mark_ingested sourceId="SRC-2026-06-26-001"
```

### Pages

#### `kb_ensure_page`
Create or update a wiki page with enforced template frontmatter.

```text
kb_ensure_page type=concept title="Async Patterns"
kb_ensure_page type=entity title="FastAPI"
kb_ensure_page type=synthesis title="Auth Architecture"
kb_ensure_page type=artifact title="Sandbox Strategy"
kb_ensure_page type=meeting title="Sprint Planning 2026-06-29"
```

Types: `concept`, `entity`, `synthesis`, `analysis`, `source`, `meeting`, `diary`, `artifact`.
Unknown types fall back to `concept`. Template loaded from `.kb/templates/pages/{type}.md`.

### Search

#### `kb_recall_context`
Project-first search across both vaults. Use at task start.

```text
kb_recall_context query="auth patterns" maxResults=10
```

With embeddings enabled, uses hybrid search (lexical + semantic). Falls back to lexical-only when
embeddings are disabled or unavailable.

#### `kb_recall_docs`
Personal-first search across both vaults. Use for library/docs lookups.

```text
kb_recall_docs query="FastAPI middleware" maxResults=10
```

Same hybrid search as `kb_recall_context` when embeddings enabled.

#### `kb_search_tags`
Filter by frontmatter tags, page type, or workflow stage.

```text
kb_search_tags tag="react"
kb_search_tags type=concept stage=production
kb_search_tags tag="python" type=entity stage=draft
```

Stages: `brainstorm` → `draft` → `review` → `production`.

### Maintenance

#### `kb_lint`
Wiki health check: orphans, broken wikilinks, empty pages, stale pages.

```text
kb_lint staleDays=30
```

Returns structured report with counts (warnings + info) and per-issue details. Broken wikilinks
are warnings; orphans, empty pages, and stale pages are informational.

#### `kb_rebuild_meta`
Manually rebuild `meta/registry.json` and `meta/backlinks.json` from wiki pages.

```text
kb_rebuild_meta
```

Normally runs automatically via `tool_result` hook. Use this if metadata seems stale.

### Enrichment

#### `kb_observe`
Capture a mid-session observation — lighter than `kb_capture`, timestamped.

```text
kb_observe title="Auth Strategy Update"
           content="JWT refresh tokens can use sliding windows for better UX"
           relevance=high
           tags=["auth", "jwt"]
           sourceContext="Discussed during API design review"
```

Relevance: `low` | `medium` | `high` | `critical`. Observations are saved to `wiki/sources/`
with `status: observation`. Use `kb_enrich` to merge into a canonical page later.

#### `kb_enrich`
Merge an observation into an existing wiki page.

```text
kb_enrich pageTitle="Auth Strategy"
           observationTitle="Auth Strategy Update"
           observationContent="JWT refresh tokens..."
           sourceContext="Discovered during API design review"
```

Uses synthesis model to intelligently merge into appropriate section. Falls back to simple
append. Includes inline user approval UI (Merge / Save as observation / Discard).

#### `kb_retro`
Atomic insight capture — single markdown file, lightweight, no source packet.

```text
kb_retro title="JWT Refresh Token Pattern"
          body="Sliding window refresh avoids..."
          category=learning
```

Categories: `decision`, `learning`, `pattern`, `bug`, `todo`.

#### `kb_log_event`
Append to `meta/events.jsonl` audit trail. Each line is a self-contained JSON object.

```text
kb_log_event kind=page_create data={pageTitle: "...", type: "concept"}
```

## Hooks (Automatic)

| Hook | When | What |
|------|------|------|
| `session_start` | Session begins | Shows vault status |
| `before_agent_start` | Before each turn | Injects KB context if prompt contains knowledge keywords |
| `tool_result` | After kb tool writes | Auto-ingests after `kb_capture`, rebuilds metadata after `kb_ensure_page` |

Guardrails (via guardrails extension API): `.kb/raw/` and `.kb/meta/` are immutable. Only
`.kb/wiki/` is editable. Registered as dynamic rules, toggleable via `/guardrails on|off`.

## Settings

```json
{
  "kb": {
    "models": {
      "task": "mimo-v2.5",
      "taskConfig": { "thinking": "low", "maxTokens": 4096 },
      "synthesis": "mimo-v2.5-pro",
      "synthesisConfig": { "thinking": "medium", "maxTokens": 8192 },
      "embedding": "nvidia/llama-nemotron-embed-vl-1b-v2:free",
      "embeddingConfig": { "dimensions": 1024 },
      "embeddingFallback": "qwen3-embedding-8b"
    },
    "embeddings": {
      "enabled": false,
      "batchSize": 50,
      "storePath": "meta/embeddings.json"
    },
    "recall": {
      "linksThreshold": 50,
      "maxResults": 5,
      "hybridWeight": 0.3
    },
    "autoIngest": true,
    "autoLint": true,
    "lint": {
      "staleDays": 30,
      "warnOnOrphans": true
    }
  }
}
```

## Guardrails

- `.kb/raw/` — immutable source packets (blocked)
- `.kb/meta/` — auto-generated (blocked)
- `.kb/wiki/` — editable

## Cross-Extension Integration

- **guardrails**: `registerRules()` API — KB registers `kb-immutable` group
- **_shared/result.ts**: `ok()`/`err()` for all tool results
- **web-access/lib/markdown.ts**: `approxTokens()` + `splitIntoChunks()` for source chunking
- **gh**: GitHub URL capture via `gh-repo-view`, `gh-issue-view`, `gh-pr-view`

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `KB_MODE` | auto-detect | `project` or `personal` |
| `KB_HOME` | `~/.kb/` | Personal vault root |
