# kb — Features

> Knowledge Base — persistent wiki vaults with 15 tools, 8 page types,
> dual-vault routing, template enforcement, tag search, and ingest pipeline.

## Core Concepts

- **Dual vaults**: project (`.kb/`) + personal (`~/.kb/`) — auto-detected by cwd
- **4-layer architecture**: `raw/` (immutable sources), `wiki/` (editable pages),
  `meta/` (auto-generated index), `config.json` (vault config)
- **8 page types**: concept, entity, synthesis, analysis, source, meeting, diary, artifact
- **Artifact lifecycle**: 7 section-tag arrays + `stage` field (brainstorm→draft→review→production)

## Tools (15)

| Tool | Description |
| ------ | ------------- |
| `kb_bootstrap` | Initialize a new vault — auto-detects project vs personal, generates AGENTS.md (3 choices) |
| `kb_ensure_page` | Create/update a wiki page — enforces template frontmatter, 8 types |
| `kb_capture` | File/text → immutable source packet in `raw/sources/SRC-*` |
| `kb_ingest` | Two-step pipeline: read `extracted.md` → synthesize wiki pages |
| `kb_recall_context` | Search project vault first (agent startup — working memory) |
| `kb_recall_docs` | Search personal vault first (implementation — docs/references) |
| `kb_search_tags` | Filter pages by tag, page type, or workflow stage |
| `kb_status` | Show vault health — page counts, pending sources, recent activity |
| `kb_rebuild_meta` | Manual metadata rebuild (registry + backlinks) |
| `kb_lint` | Health check — orphan pages, broken wikilinks, empty/stale pages |
| `kb_observe` | Mid-session observation capture (searchable via recall) |
| `kb_retro` | End-of-task insight capture (lightweight, single file) |
| `kb_enrich` | Merge observation into existing page (with user approval) |
| `kb_log_event` | Append event to audit trail (`meta/events.jsonl`) |
| `kb_mark_ingested` | Mark source as processed (removes from pending list) |

## Lifecycle Hooks

| Hook | Action |
| ------ | -------- |
| `session_start` | Auto-run ingest + lint if enabled in settings |
| `before_agent_start` | Auto-recall context from project vault |
| `tool_result` | Auto-rebuild meta after wiki edits |

## Internal Modules

| File | Purpose |
| ------ | --------- |
| `lib/vault.ts` | Vault path resolution, routing, `resolveVaultContext()` |
| `lib/capture.ts` | File/text → source packet (manifest + original + extracted) |
| `lib/models.ts` | Model config + API client for task/synthesis/embedding |
| `lib/recall.ts` | Search + tag filtering (lexical + optional embeddings) |
| `lib/templates.ts` | Template loading (vault first, extension fallback) |
| `lib/ingest.ts` | Source extraction and wiki page creation pipeline |
| `lib/notify.ts` | Notification helpers |

## Skills

| Skill | Location |
|------- | ---------- |
| `kb` | `skills/kb/SKILL.md` |
| `kb-bootstrap` | `skills/kb-bootstrap/SKILL.md` |
| `kb-capture-url` | `skills/kb-capture-url/SKILL.md` |
| `kb-research` | `skills/kb-research/SKILL.md` |
| `kb-update` | `skills/kb-update/SKILL.md` |

## Model Configuration

Configured in `settings.json`:

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

- Uses `_shared/result.ts` (only extension that imports from `_shared`)
- Uses `_shared/spawn.ts` for background ingest
- Registers guardrails via `guardrails/api.ts` to protect `raw/**` and `meta/**`
- `web-access` writes KB source packets via duplicated `kb-packets.ts`

## Vault Layout

```
.kb/
├── config.json          # vault config + model settings
├── raw/sources/         # SRC-YYYY-MM-DD-NN/ + extracted.md
├── wiki/
│   ├── concepts/
│   ├── entities/
│   ├── syntheses/
│   ├── analyses/
│   ├── sources/
│   ├── meetings/
│   ├── diaries/
│   └── artifacts/
├── meta/                # registry.json, backlinks.json, events.jsonl
└── templates/           # pages/*.md (per-vault copy)
```
