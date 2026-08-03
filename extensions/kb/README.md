# KB Extension

Knowledge Base for pi — persistent wiki vaults for project context, documentation, insights, and workflow pipelines.

## Installation

Auto-discovered from `~/.pi/agent/extensions/kb/`. No settings.json entry needed.

## Tools (24)

### Bootstrap & Status

| Tool | Description |
|------|-------------|
| `kb_bootstrap` | Initialize a new KB vault (auto-detects project/personal mode) |
| `kb_status` | Show vault status: mode, page counts, pending sources |

### Content Capture & Ingest

| Tool | Description |
|------|-------------|
| `kb_capture` | Capture file or text as immutable source packet in `raw/sources/` |
| `kb_ingest` | List uningested sources pending wiki page creation |
| `kb_mark_ingested` | Mark a source as processed (removes from pending list) |

### Page Creation

| Tool | Description |
|------|-------------|
| `kb_ensure_page` | Create/update wiki page from type-enforced template (14 types) |
| `kb_create_research` | Track a research question with sources + confidence (`RES-XXX`) |
| `kb_create_project` | Create a new project vault in a git repo |
| `kb_list_projects` | List all registered project vaults |
| `kb_create_project_page` | Create the root project container page (`PROJ-XXX`) |
| `kb_create_brainstorm` | Capture/refine ideas for a project (`BR-XXX`) |
| `kb_create_sprint_plan` | Define sprint scope + track specs (`SP-XXX`) |
| `kb_create_spec` | Define a feature + track implementation tasks (`SPEC-XXX`) |
| `kb_create_task` | Define an atomic work unit (`TASK-XXX`) |
| `kb_kanban` | Render project Kanban view (tasks grouped by status) |

### Recall & Search

| Tool | Description |
|------|-------------|
| `kb_recall_context` | Search both vaults (project-first) for working context |
| `kb_recall_docs` | Search both vaults (personal-first) for documentation |
| `kb_search_tags` | Filter pages by `tag`, `type`, `stage`, `status`, or `run` |

### Maintenance

| Tool | Description |
|------|-------------|
| `kb_rebuild_meta` | Manually rebuild registry + backlinks |
| `kb_lint` | Health check: orphans, broken links, stale pages |

### Observation & Enrichment

| Tool | Description |
|------|-------------|
| `kb_observe` | Mid-session observation capture (searchable via recall) |
| `kb_enrich` | Merge observation into existing page (with user approval) |
| `kb_retro` | Atomic insight capture at task end |
| `kb_log_event` | Append event to audit trail (`meta/events.jsonl`) |

## Page Types (14)

### Knowledge types

| Type | Directory | ID prefix | Purpose |
|------|-----------|-----------|---------|
| `concept` | `wiki/concepts/` | — | Abstract ideas, patterns, principles |
| `entity` | `wiki/entities/` | — | People, tools, projects |
| `synthesis` | `wiki/syntheses/` | — | Multi-source consolidated knowledge |
| `analysis` | `wiki/analyses/` | — | In-depth evaluation or comparison |
| `source` | `wiki/sources/` | — | Single-source captured content |
| `research` | `wiki/research/` | `RES-` | Research investigations |
| `handoff` | `wiki/handoffs/` | `HOFF-` | Session-handoff pages |

### Pipeline types

| Type | Directory | ID prefix | Purpose |
|------|-----------|-----------|---------|
| `project` | `wiki/projects/` | `PROJ-` | Project root page |
| `library-doc` | `wiki/libraries/` | `LIB-` | Saved web resources |
| `daily-log` | `wiki/dailies/` | `DAY-` | Daily diaries / EOD summaries |
| `brainstorm` | `wiki/brainstorms/` | `BR-` | Brainstorms (linked to project) |
| `sprint-plan` | `wiki/plans/` | `SP-` | Sprint scope + spec links |
| `spec` | `wiki/specs/` | `SPEC-` | Feature specs (linked to sprint plan) |
| `task` | `wiki/tasks/` | `TASK-` | Atomic work units (linked to spec) |

## Frontmatter Fields

### Standard (all pages)
| Field | Description |
|-------|-------------|
| `title` | Page title |
| `type` | Page type (one of 14) |
| `tags` | YAML array of tags |
| `stage` | Workflow stage: `brainstorm`, `draft`, `review`, `production` |
| `created` | Creation date |
| `updated` | Last update date |

### Run / Flow tracking
| Field | Description |
|-------|-------------|
| `run` | Run ID linking pages together (e.g. `RUN-2026-07-23-001`) |
| `status` | Execution status: `exploring`, `draft`, `decided`, `in_progress`, `done`, `blocked` |
| `started_at` | ISO timestamp when stage began |
| `completed_at` | ISO timestamp when stage finished |
| `execution_time` | Human-readable duration (e.g. `35m`) |
| `todos` | YAML list of `- [x]` / `- [ ]` task items |
| `related_pages` | Links to other pages in the same run |
| `depends_on` | Upstream stage pages this page depends on |

All of these are indexed in `meta/registry.json` and searchable via `kb_search_tags` and `kb_recall_context`.

## Vault Structure

```
.kb/
├── config.json           # vault mode, topic
├── AGENTS.md             # agent-facing quick-ref
├── templates/pages/      # 14 page-type templates (enforced on kb_ensure_page)
├── wiki/<dir>/           # wiki pages grouped by type
├── raw/sources/          # immutable source packets (SRC-YYYY-MM-DD-NNN/)
└── meta/
    ├── registry.json     # all pages with frontmatter (id, path, title, type, tags, stage, status, run)
    ├── backlinks.json    # wikilink cross-references
    └── events.jsonl      # audit trail
```

## Vault Routing

| Content | Target | Rule |
|---------|--------|------|
| Library docs, notes | **Personal** (`~/.kb/`) | Use `vault: personal` |
| Project artifacts, WIP | **Project** (`.kb/`) | Use `vault: project` |
| Everything else | **Project** | Default |
| Ambiguous | Ask user | Via `ask_user_question` |

## Model Configuration

Optional — configure in `settings.json`:

```json
{
  "kb": {
    "models": {
      "task": { "provider": "curated", "id": "qwen/qwen3.7-flash", "thinking": "low" },
      "synthesis": { "provider": "curated", "id": "openai/gpt-5-nano", "thinking": "medium" },
      "embedding": { "provider": "openrouter", "id": "nvidia/llama-nemotron-embed-vl-1b-v2:free" }
    },
    "embeddings": { "enabled": false },
    "autoIngest": true,
    "autoLint": true
  }
}
```

## Architecture

```
kb/
├── index.ts                # 15 core tool registrations + lifecycle hooks
├── lib/
│   ├── vault.ts            # Vault path resolution, routing, DIR_NAMES, ID_PREFIXES
│   ├── capture.ts          # File/text → source packet
│   ├── ingest.ts           # Pending source listing
│   ├── metadata.ts         # Registry + backlinks rebuild (parses run, status from frontmatter)
│   ├── lint.ts             # Wiki health checks
│   ├── templates.ts        # Page builder + template writer (14 types)
│   ├── models.ts           # Model config + API client
│   ├── embeddings.ts       # Vector storage + hybrid search
│   ├── enrich.ts           # Observation → page merging
│   ├── observe.ts          # Observation capture
│   ├── retro.ts            # Insight capture
│   ├── events.ts           # Audit trail logging
│   ├── recall.ts           # Search + tag/type/stage/status/run filtering
│   ├── create-tools.ts     # 9 typed kb_create_* / kb_kanban tool registrations
│   └── guardrails.ts       # KB raw/meta protection
├── skills/                 # kb-bootstrap, kb-capture-url, kb-research, kb-update
├── templates/pages/        # 14 page templates
├── test/                   # Vitest tests
└── README.md
```

## Testing

```bash
cd ~/.pi/agent/extensions
npx vitest run kb
```