# KB Extension

Knowledge Base for pi — persistent wiki vaults for project context, documentation, and insights.

## Installation

Auto-discovered from `~/.pi/agent/extensions/kb/`. No settings.json entry needed.

## Tools (15)

### Bootstrap & Status

| Tool | Description |
|------|-------------|
| `kb_bootstrap` | Initialize a new KB vault (auto-detects project/personal mode) |
| `kb_status` | Show vault status: mode, page counts, pending sources |

### Content Capture

| Tool | Description |
| ------ | ------------- |
| `kb_capture` | Capture file or text as immutable source packet in `raw/sources/` |
| `kb_ingest` | List uningested sources pending wiki page creation |
| `kb_mark_ingested` | Mark a source as processed (removes from pending list) |

### Page Creation & Search

| Tool | Description |
| ------ | ------------- |
| `kb_ensure_page` | Create/update wiki page from type-enforced template |
| `kb_recall_context` | Search both vaults (project-first) for working context |
| `kb_recall_docs` | Search both vaults (personal-first) for documentation |
| `kb_search_tags` | Filter pages by tag, type, or workflow stage |

### Maintenance

| Tool | Description |
|------|-------------|
| `kb_rebuild_meta` | Manually rebuild registry + backlinks |
| `kb_lint` | Health check: orphans, broken links, stale pages |

### Capture & Enrichment

| Tool | Description |
| ------ | ------------- |
| `kb_observe` | Mid-session observation capture (searchable via recall) |
| `kb_enrich` | Merge observation into existing page (with user approval) |
| `kb_retro` | Atomic insight capture at task end |
| `kb_log_event` | Append event to audit trail (`meta/events.jsonl`) |

## Page Types

| Type | Directory | Purpose |
| ------ | ----------- | --------- |
| `concept` | `wiki/concepts/` | Abstract ideas, patterns, principles |
| `entity` | `wiki/entities/` | People, tools, projects |
| `synthesis` | `wiki/syntheses/` | Multi-source consolidated knowledge |
| `analysis` | `wiki/analyses/` | In-depth evaluation or comparison |
| `source` | `wiki/sources/` | Single-source captured content |
| `meeting` | `wiki/meetings/` | Meeting notes |
| `diary` | `wiki/diaries/` | Session diaries |
| `artifact` | `wiki/artifacts/` | WIP project documents |

## Vault Structure

```
.kb/
├── config.json           # vault mode, topic
├── AGENTS.md             # agent-facing quick-ref
├── templates/pages/      # 8 page-type templates (enforced on kb_ensure_page)
├── wiki/{type}s/         # wiki pages grouped by type
├── raw/sources/          # immutable source packets (SRC-YYYY-MM-DD-NNN/)
└── meta/
    ├── registry.json     # all pages with frontmatter
    ├── backlinks.json    # wikilink cross-references
    └── events.jsonl      # audit trail
```

## Vault Routing

| Content | Target | Rule |
| --------- | -------- | ------ |
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
├── index.ts            # 15 tool registrations + lifecycle hooks
├── lib/
│   ├── vault.ts        # Vault path resolution, routing
│   ├── capture.ts      # File/text → source packet
│   ├── ingest.ts       # Pending source listing
│   ├── metadata.ts     # Registry + backlinks rebuild
│   ├── lint.ts         # Wiki health checks
│   ├── templates.ts    # Page builder + template writer
│   ├── models.ts       # Model config + API client
│   ├── embeddings.ts   # Vector storage + hybrid search
│   ├── enrich.ts       # Observation → page merging
│   ├── observe.ts      # Observation capture
│   ├── retro.ts        # Insight capture
│   ├── events.ts       # Audit trail logging
│   ├── recall.ts       # Search + tag filtering
│   └── guardrails.ts   # KB raw/meta protection
├── skills/             # 5 workflow skills
├── templates/          # page templates (concept/entity/synthesis/...)
├── test/               # Vitest tests
└── README.md
```

## Testing

```bash
cd ~/.pi/agent/extensions
npx vitest run kb
```
