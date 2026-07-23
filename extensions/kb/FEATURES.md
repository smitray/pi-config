# kb — Features

> Knowledge Base — persistent wiki vaults with 24 tools, 16 page types,
> dual-vault routing, template enforcement, tag/status/run search, and flow integration.

## Core Concepts

- **Dual vaults**: project (`.kb/`) + personal (`~/.kb/`) — auto-detected by cwd
- **4-layer architecture**: `raw/` (immutable sources), `wiki/` (editable pages),
  `meta/` (auto-generated index), `config.json` (vault config)
- **16 page types**: concept, entity, synthesis, analysis, source, meeting, diary, handoff,
  artifact, schedule, library, research, plan, content, ticket, todo
- **Flow frontmatter**: `run`, `status`, `started_at`, `completed_at`, `todos`, `gortex_refs`, `related_pages`, `depends_on`
- **Artifact lifecycle**: 7 section-tag arrays + `stage` field (brainstorm→draft→review→production)

## Tools (24)

### Bootstrap & Status
| Tool | Description |
|------|-------------|
| `kb_bootstrap` | Initialize a new vault — auto-detects project vs personal |
| `kb_status` | Show vault health — page counts, pending sources, recent activity |

### Capture & Ingest
| Tool | Description |
|------|-------------|
| `kb_capture` | File/text → immutable source packet in `raw/sources/SRC-*` |
| `kb_ingest` | Two-step pipeline: read `extracted.md` → synthesize wiki pages |
| `kb_mark_ingested` | Mark source as processed |

### Page Creation
| Tool | Description |
|------|-------------|
| `kb_ensure_page` | Create/update wiki page — enforces template frontmatter, 16 types |
| `kb_create_schedule` | Daily time-blocked schedule (`SCHED-XXX`) |
| `kb_create_library` | Web resource with auto-fetched metadata (`LIB-XXX`) |
| `kb_create_research` | Research question with sources + confidence (`RES-XXX`) |
| `kb_create_plan` | Planning/brainstorming document (`PLAN-XXX`) |
| `kb_create_content` | Social media content card (`CONT-XXX`) |
| `kb_create_ticket` | Project ticket with owner/priority (`TICK-XXX`) |
| `kb_create_todo` | TODO linked to parent ticket/artifact (`TODO-XXX`) |
| `kb_create_project` | Create project vault in git repo |
| `kb_list_projects` | List all registered project vaults |

### Recall & Search
| Tool | Description |
|------|-------------|
| `kb_recall_context` | Search project vault first (agent startup — working memory) |
| `kb_recall_docs` | Search personal vault first (docs/references) |
| `kb_search_tags` | Filter by `tag`, `type`, `stage`, `status`, or `run` |

### Maintenance
| Tool | Description |
|------|-------------|
| `kb_rebuild_meta` | Manual metadata rebuild (registry + backlinks) |
| `kb_lint` | Health check — orphan pages, broken wikilinks, empty/stale pages |

### Observation & Enrichment
| Tool | Description |
|------|-------------|
| `kb_observe` | Mid-session observation capture |
| `kb_retro` | End-of-task insight capture (lightweight, single file) |
| `kb_enrich` | Merge observation into existing page (with user approval) |
| `kb_log_event` | Append event to audit trail (`meta/events.jsonl`) |

## Lifecycle Hooks

| Hook | Action |
|------|--------|
| `session_start` | Show KB status in footer |
| `before_agent_start` | Auto-recall context from project vault (keyword-triggered) |
| `tool_result` | Auto-rebuild meta after wiki edits; auto-ingest + auto-lint (configurable) |

## Internal Modules

| File | Purpose |
|------|---------|
| `lib/vault.ts` | Vault path resolution, routing, `DIR_NAMES`, `ID_PREFIXES` |
| `lib/capture.ts` | File/text → source packet (manifest + original + extracted) |
| `lib/models.ts` | Model config + API client for task/synthesis/embedding |
| `lib/recall.ts` | Search + tag/type/stage/status/run filtering (lexical + hybrid) |
| `lib/templates.ts` | Template loading (vault first, extension fallback), 16 types |
| `lib/metadata.ts` | Registry + backlinks rebuild (parses run, status from frontmatter) |
| `lib/create-tools.ts` | 8 `kb_create_*` typed tool registrations |
| `lib/ingest.ts` | Source extraction and wiki page creation pipeline |

## Skills

| Skill | Location |
|-------|----------|
| `kb` | `skills/kb/SKILL.md` |
| `kb-bootstrap` | `skills/kb-bootstrap/SKILL.md` |
| `kb-capture-url` | `skills/kb-capture-url/SKILL.md` |
| `kb-research` | `skills/kb-research/SKILL.md` |
| `kb-update` | `skills/kb-update/SKILL.md` |

## Model Configuration

```json
{
  "kb": {
    "models": {
      "task": { "provider": "xiaomi-token-plan-sgp", "id": "mimo-v2.5" },
      "synthesis": { "provider": "xiaomi-token-plan-sgp", "id": "mimo-v2.5-pro" },
      "embedding": { "provider": "openrouter", "id": "nvidia/llama-nemotron-embed-vl-1b-v2:free" }
    },
    "embeddings": { "enabled": false },
    "autoIngest": true,
    "autoLint": true
  }
}
```

## Cross-Extension

- Uses `_shared/result.ts`
- Registers guardrails via `guardrails/api.ts` to protect `raw/**` and `meta/**`
- `flow` extension reads/writes KB pages via `kb-bridge.ts` importing `lib/templates`, `lib/recall`
- `web-access` writes KB source packets via duplicated `kb-packets.ts`

## Vault Layout

```
.kb/
├── config.json          # vault config + model settings
├── raw/sources/         # SRC-YYYY-MM-DD-NN/ + extracted.md
├── wiki/
│   ├── concepts/  entities/  syntheses/  analyses/  sources/
│   ├── meetings/  diaries/   handoffs/   artifacts/
│   └── schedules/ libraries/ research/   plans/  contents/  tickets/  todos/
├── meta/                # registry.json, backlinks.json, events.jsonl
└── templates/pages/     # 16 per-vault template copies
```
