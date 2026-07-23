# KB Extension

Knowledge Base for pi — persistent wiki vaults for project context, documentation, insights, and workflow state. Single source of truth for the `flow` extension.

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
| `kb_ensure_page` | Create/update wiki page from type-enforced template (16 types) |
| `kb_create_schedule` | Create a daily time-blocked schedule (`SCHED-XXX`) |
| `kb_create_library` | Save a web resource with auto-fetched metadata (`LIB-XXX`) |
| `kb_create_research` | Track a research question with sources + confidence (`RES-XXX`) |
| `kb_create_plan` | Create a planning/brainstorming document (`PLAN-XXX`) |
| `kb_create_content` | Plan social media content across platforms (`CONT-XXX`) |
| `kb_create_ticket` | Create a project ticket with owner/priority/status (`TICK-XXX`) |
| `kb_create_todo` | Create a TODO linked to a parent ticket/artifact (`TODO-XXX`) |
| `kb_create_project` | Create a new project vault in a git repo |
| `kb_list_projects` | List all registered project vaults |

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

## Page Types (16)

| Type | Directory | Purpose |
|------|-----------|---------|
| `concept` | `wiki/concepts/` | Abstract ideas, patterns, principles |
| `entity` | `wiki/entities/` | People, tools, projects |
| `synthesis` | `wiki/syntheses/` | Multi-source consolidated knowledge |
| `analysis` | `wiki/analyses/` | In-depth evaluation or comparison |
| `source` | `wiki/sources/` | Single-source captured content |
| `meeting` | `wiki/meetings/` | Meeting notes |
| `diary` | `wiki/diaries/` | Session diaries, handoffs, EOD summaries |
| `handoff` | `wiki/handoffs/` | Flow run handoff pages (`HOFF-XXX`) |
| `artifact` | `wiki/artifacts/` | WIP implementation artifacts |
| `schedule` | `wiki/schedules/` | Daily time-blocked schedules |
| `library` | `wiki/libraries/` | Saved web resources |
| `research` | `wiki/research/` | Research investigations |
| `plan` | `wiki/plans/` | Planning and brainstorming |
| `content` | `wiki/contents/` | Social media content cards |
| `ticket` | `wiki/tickets/` | Project tickets |
| `todo` | `wiki/todos/` | Actionable task items |

## Frontmatter Fields

### Standard (all pages)
| Field | Description |
|-------|-------------|
| `title` | Page title |
| `type` | Page type (one of 16) |
| `tags` | YAML array of tags |
| `stage` | Workflow stage: `brainstorm`, `draft`, `review`, `production` |
| `created` | Creation date |
| `updated` | Last update date |

### Flow / Run tracking
| Field | Description |
|-------|-------------|
| `run` | Run ID linking pages to a flow run (e.g. `RUN-2026-07-23-001`) |
| `status` | Execution status: `exploring`, `draft`, `decided`, `in_progress`, `done`, `blocked` |
| `started_at` | ISO timestamp when stage began |
| `completed_at` | ISO timestamp when stage finished |
| `execution_time` | Human-readable duration (e.g. `35m`) |
| `todos` | YAML list of `- [x]` / `- [ ]` task items |
| `gortex_refs` | Code surface references (`agent/extensions/...::symbol`) |
| `related_pages` | Links to other pages in the same run |
| `depends_on` | Upstream stage pages this page depends on |

All of these are indexed in `meta/registry.json` and searchable via `kb_search_tags` and `kb_recall_context`.

## Vault Structure

```
.kb/
├── config.json           # vault mode, topic
├── AGENTS.md             # agent-facing quick-ref
├── templates/pages/      # 16 page-type templates (enforced on kb_ensure_page)
├── wiki/{type}s/         # wiki pages grouped by type
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
      "task": { "provider": "xiaomi-token-plan-sgp", "id": "mimo-v2.5", "thinking": "low" },
      "synthesis": { "provider": "xiaomi-token-plan-sgp", "id": "mimo-v2.5-pro", "thinking": "medium" },
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
├── index.ts            # 24 tool registrations + lifecycle hooks
├── lib/
│   ├── vault.ts        # Vault path resolution, routing, DIR_NAMES, ID_PREFIXES
│   ├── capture.ts      # File/text → source packet
│   ├── ingest.ts       # Pending source listing
│   ├── metadata.ts     # Registry + backlinks rebuild (parses run, status from frontmatter)
│   ├── lint.ts         # Wiki health checks
│   ├── templates.ts    # Page builder + template writer (16 types, handoff included)
│   ├── models.ts       # Model config + API client
│   ├── embeddings.ts   # Vector storage + hybrid search
│   ├── enrich.ts       # Observation → page merging
│   ├── observe.ts      # Observation capture
│   ├── retro.ts        # Insight capture
│   ├── events.ts       # Audit trail logging
│   ├── recall.ts       # Search + tag/type/stage/status/run filtering
│   ├── create-tools.ts # kb_create_* tool registrations (8 typed tools)
│   └── guardrails.ts   # KB raw/meta protection
├── skills/             # 5 workflow skills
├── templates/pages/    # 16 page templates
├── test/               # Vitest tests (102 tests)
└── README.md
```

## Testing

```bash
cd ~/.pi/agent/extensions
npx vitest run kb
```

---

## Flow Integration

The `flow` extension uses KB as its single source of truth for all run state, artifacts, and execution history. Each stage creates or updates a KB page keyed by `run_id`.

### Run Lifecycle

```
/ask-me → creates run plan (type: plan, status: draft)
         → research   (type: research, status: exploring)
         → blueprint  (type: plan, status: draft)
         → design     (type: plan, status: draft)
         → plan       (type: plan, status: decided)
         → implement  (type: artifact, status: in_progress)
         → validate   (type: analysis, status: draft)
         → code-review(type: analysis, status: draft)
         → commit     (type: diary, status: published)
         → architecture-review (type: analysis, status: draft)
         → security-gate      (type: observation, inline)
         → handoff    (type: diary, status: done)
```

### Per-Stage KB Usage

| # | Stage | KB tool | Page type | Frontmatter | Prompt / Trigger |
|---|-------|---------|-----------|-------------|------------------|
| 1 | **research** | `kb_create_research` | `research` | `run: RUN-...`, `stage: research`, `status: exploring`, `started_at: ...` | "Read the run plan. Explore the codebase via gortex. Identify scope, trace call-paths, list open questions. Write findings." | `research/auth-middleware-2026-07-23-v1.md` |
| 2 | **blueprint** | `kb_ensure_page(type=plan)` | `plan` | `run: RUN-...`, `stage: blueprint`, `depends_on: [research/...]`, `reads: [research/...]` | "Read research page. Identify patterns, reusable components, data flow. Produce architecture sketch." | `plans/auth-middleware-blueprint-2026-07-23-v1.md` |
| 3 | **design** | `kb_ensure_page(type=plan)` | `plan` | `run: RUN-...`, `stage: design`, `depends_on: [blueprint/...]` | "Read blueprint. Scan integrations, locate precedents. Produce detailed design with interfaces." | `plans/auth-middleware-design-2026-07-23-v1.md` |
| 4 | **plan** | `kb_ensure_page(type=plan)` | `plan` | `run: RUN-...`, `stage: plan`, `status: decided`, `depends_on: [design/...]` | "Read design. Break into implementation slices. Create tickets + todos with blocking edges. Set status=decided." | `plans/auth-middleware-plan-2026-07-23-v1.md` |
| 5 | **implement** | `kb_create_ticket` / `kb_create_todo` / `kb_ensure_page(type=artifact)` | `artifact` | `run: RUN-...`, `stage: implement`, `status: in_progress`, `todos: [...], gortex_refs: [...]` | "Read plan. Implement slice-by-slice via TDD. Update artifact page with progress, code refs, test results." | `artifacts/auth-middleware-2026-07-23-v1.md` |
| 6 | **validate** | `kb_ensure_page(type=analysis)` | `analysis` | `run: RUN-...`, `stage: validate`, `depends_on: [artifact/...]`, `gortex_refs: [...]` | "Read artifact page. Verify each slice: tests pass, types check, no regressions. Write validation report." | `analyses/auth-middleware-validate-2026-07-23-v1.md` |
| 7 | **code-review** | `kb_ensure_page(type=analysis)` | `analysis` | `run: RUN-...`, `stage: code-review`, `depends_on: [artifact/...]`, `todos: [...]` | "Parallel review: Standards axis (lint/style/patterns) + Spec axis (does it match the plan?). Report blockers_count." | `analyses/auth-middleware-review-2026-07-23-v1.md` |
| 8 | **commit** | `kb_ensure_page(type=diary)` | `diary` | `run: RUN-...`, `stage: commit`, `status: published` | "Run git commit with Conventional Commits. Record hash + message in diary." | `diaries/auth-middleware-commit-2026-07-23.md` |
| 9 | **architecture-review** | `kb_ensure_page(type=analysis)` | `analysis` | `run: RUN-...`, `stage: architecture-review`, `depends_on: [code-review/...]` | "Full architecture panel: coupling, cohesion, tech-debt, security posture. Visual HTML report + KB analysis." | `analyses/auth-middleware-arch-review-2026-07-23-v1.md` |
| 10 | **security-gate** | `kb_observe` | `observation` | `run: RUN-...`, `stage: security-gate` | "Script-only: check PR flags, halt if BLOCK. No LLM session." | `sources/auth-middleware-security-2026-07-23.md` |
| 11 | **handoff** `/flow-handoff` | `kb_ensure_page(type=handoff)` | `handoff` | `run: RUN-...`, `stage: handoff`, `handoff_for: "next-session"` | "Read run plan + all stage pages. Summarise: completed stages, current stage, blockers, next step, links." | `handoffs/auth-middleware-handoff-2026-07-23.md` |

### EOD Diary

At end of day, `/flow-eod` reads the run plan's stage registry and writes/updates `diary/<YYYY-MM-DD>.md`:

```
## 2026-07-23 — refactor auth middleware (RUN-2026-07-23-001)
- Status: code-review in progress
- Run plan: [[plans/RUN-2026-07-23-001]]
- Current stage: [[analyses/code-review-RUN-...]]
- Blockers: —
- Next: commit if blockers_count = 0
```

### Searching Flow Runs

```
# All pages in a specific run
kb_search_tags(run="RUN-2026-07-23-001")

# All research pages still exploring
kb_search_tags(type="research", status="exploring")

# Blocked stages
kb_search_tags(status="blocked")

# Full run context
kb_recall_context("RUN-2026-07-23-001")
```

### Gortex Bridge

Each stage page carries `gortex_refs` frontmatter linking to code surfaces Gortex touched:

```yaml
gortex_refs:
  - ref: extensions/api/index.ts::createHandler
    role: modify
  - ref: extensions/kb/lib/vault.ts::resolveVaultContext
    role: read
```

This bridges the KB → Gortex gap: `kb_recall_context` surfaces the code surface, Gortex `explore` opens it directly.
