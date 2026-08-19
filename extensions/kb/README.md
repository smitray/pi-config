# KB Extension

Knowledge Base for pi — persistent wiki vaults for project context, documentation, insights, and workflow pipelines.

## Installation

Auto-discovered from `~/.pi/agent/extensions/kb/`. No settings.json entry needed.

## Architecture: three layers

1. **Knowledge book** — strict three-file-system vault (`raw/` immutable, `wiki/` write-restricted to typed tools, `meta/` extension-only). Direct writes to `wiki/` are blocked by guardrails.
2. **Flow engine** — 12 named flows (`build`, `research`, `design`, `diff-review`, `architecture-review`, `pr-triage`, `greenfield`, `retry-after-failure`, `onboarding`, `maintenance`, `decision-logging`, `session-handoff`) walked via `kb_flow`. Each stage emits a handoff into a per-task chain — the audit trail.
3. **Role packages** — 9 roles (`orchestrator`, `designer`, `implementer`, `reviewer`, `researcher`, `diagnoser`, `onboarder`, `architect`, `writer`), each listing the skills loaded when that subagent role is spawned. Role pages live in `wiki/agents/`; `kb_role_install` / `kb_role_list` manage them.

## Tools (29)

### Bootstrap & Scaffolding

| Tool | Description |
|------|-------------|
| `kb_scaffold` | Full project bootstrap: vault, 16 templates, CONTEXT page, 9 role pages, flow skill, AGENTS.md, seed ADR. Idempotent |
| `kb_bootstrap` | Minimal vault init (auto-detects project/personal mode) |
| `kb_status` | Vault status: mode, page counts, pending sources, role install status |

### Content Capture & Ingest

| Tool | Description |
|------|-------------|
| `kb_capture` | Capture file or text as immutable source packet in `raw/sources/` |
| `kb_ingest` | List uningested sources pending wiki page creation |
| `kb_mark_ingested` | Mark a source as processed (removes from pending list) |

### Page Creation (the only path into wiki/)

| Tool | Description |
|------|-------------|
| `kb_ensure_page` | Create/update wiki page from type-enforced template (16 types). Rejects unknown types |
| `kb_ensure_context`-style CONTEXT page | Create via `kb_ensure_page type=context` |
| `kb_record_decision`-style ADR | Create via `kb_ensure_page type=adr` |
| `kb_create_handoff` | Record a stage handoff with chain pointers (`HOFF-`) |
| `kb_create_sprint_plan` | Define sprint scope + track specs (`SP-XXX`) |
| `kb_create_spec` | Define a feature + track implementation tasks (`SPEC-XXX`) |
| `kb_create_task` | Define an atomic work unit (`TASK-XXX`) |
| `kb_kanban` | Render project Kanban view (tasks grouped by status) |

### Flow Engine

| Tool | Description |
|------|-------------|
| `kb_flow` | State machine over the 12 flows. Actions: `start`, `advance`, `loop_back`, `status`, `complete` |
| `kb_list_handoffs` | Query handoffs by stage / task / project / status |
| `kb_get_handoff_chain` | Ordered handoff chain for a task (walked via pointers) |
| `kb_get_project_state` | Pipeline state: which tasks are at which stage, blocked, done |

### Role Packages

| Tool | Description |
|------|-------------|
| `kb_role_install` | Install/extend a role's skill bundle; updates role registry. Idempotent |
| `kb_role_list` | All roles, their skills, install status |

### Search & Maintenance

| Tool | Description |
|------|-------------|
| `kb_recall_context` | Search, project-vault first |
| `kb_recall_docs` | Search, personal-vault first |
| `kb_search_tags` | Filter by tag / type / stage / status / run |
| `kb_lint` | Health check: orphans, broken links, frontmatter-type mismatches, broken handoff chains, bad `derived_from`, role-skill gaps. `strict=true` fails on warnings |
| `kb_rebuild_meta` | Rebuild registry + backlinks |
| `kb_observe` | Capture a mid-session observation |
| `kb_enrich` | Merge an observation into an existing page (user-approved) |
| `kb_retro` | Save an atomic insight at task end |
| `kb_log_event` | Append to the audit trail |

### Deprecated (one-release warning, still functional)

| Tool | Replaced by |
|------|-------------|
| `kb_create_research` | `kb_ensure_page type=research` |
| `kb_create_project` | `kb_scaffold` |
| `kb_list_projects` | `kb_status` |
| `kb_create_project_page` | `kb_ensure_page type=project` |
| `kb_create_brainstorm` | `kb_ensure_page type=brainstorm` |

## Page Types (16)

| Type | Dir | ID | Notes |
|------|-----|----|-------|
| `concept` | concepts/ | — | Abstract ideas, patterns |
| `entity` | entities/ | — | People, tools, projects, libraries |
| `synthesis` | syntheses/ | — | Multi-source consolidated knowledge |
| `analysis` | analyses/ | — | Comparison, trade-offs |
| `source` | sources/ | — | Summary of a captured source |
| `research` | research/ | `RES-` | Research investigations |
| `context` | context/ | — | Project ubiquitous language (CONTEXT.md equivalent) |
| `adr` | adrs/ | `ADR-` | Architecture Decision Records, never edited in place |
| `handoff` | handoffs/ | `HOFF-` | Per-stage state transfer; chain pointers |
| `project` | projects/ | `PROJ-` | Project root page |
| `library-doc` | libraries/ | `LIB-` | Saved web resources |
| `daily-log` | dailies/ | `DAY-` | Daily diaries / EOD summaries |
| `brainstorm` | brainstorms/ | `BR-` | Brainstorm sessions |
| `sprint-plan` | plans/ | `SP-` | Sprint scope |
| `spec` | specs/ | `SPEC-` | Feature specs |
| `task` | tasks/ | `TASK-` | Atomic work units |

## Discipline

- `raw/` is immutable — only `kb_capture` writes there.
- `wiki/` is write-restricted — only typed tools write pages. Guardrails block direct writes.
- `meta/` is auto-generated — never edit by hand.
- Handoffs are the audit trail: record one per stage via `kb_create_handoff` (or let `kb_flow` do it).
- `derived_from` on knowledge pages traces compiled knowledge back to its sources.

## Development

```bash
cd extensions
npm test            # all tests (vitest)
npm run lint:fix    # biome
npm run typecheck   # tsc --noEmit
```
