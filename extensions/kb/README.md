# KB — Knowledge Base Extension

Self-contained `.kb/` vaults with wiki pages, source capture, AI-powered enrichment, and semantic search.

## Quick Start

```bash
# 1. Initialize a personal KB vault (~/.kb/)
kb_bootstrap

# 2. Initialize a project KB vault (current directory)
kb_bootstrap

# 3. Capture content
kb_capture source="https://example.com" title="Example Article" type=text
kb_capture source=/path/to/file.txt title="My Notes" type=file

# 4. Ingest pending sources
kb_ingest

# 5. Create wiki pages
kb_ensure_page type=concept title="My Concept" content="## Overview\n\nContent here."

# 6. Search the KB
kb_recall_context query="my topic"          # project-first
kb_recall_docs query="my topic"             # personal-first
kb_search_tags tag="architecture"           # search by tag

# 7. Enrich existing pages
kb_observe title="New finding" content="..." relevance=high
kb_enrich pageTitle="Existing Page" observationTitle="New finding" observationContent="..."

# 8. Check health
kb_status
kb_lint
```

## Tools (15 total)

### Vault Management

| Tool | Description | Parameters |
|------|-------------|------------|
| `kb_bootstrap` | Initialize vault | `topic?`, `mode?`, `root?` |
| `kb_status` | Show vault status | `vault?` |

### Content Capture

| Tool | Description | Parameters |
|------|-------------|------------|
| `kb_capture` | Capture file/text into KB | `source`, `title`, `type?`, `vault?` |
| `kb_ingest` | List uningested sources | `vault?` |
| `kb_mark_ingested` | Mark source as processed | `sourceId`, `vault?` |

### Wiki Pages

| Tool | Description | Parameters |
|------|-------------|------------|
| `kb_ensure_page` | Create/update wiki page | `type`, `title`, `content?`, `tags?`, `vault?` |
| `kb_search_tags` | Search by tag/type/stage | `tag?`, `type?`, `stage?` |
| `kb_rebuild_meta` | Rebuild registry + backlinks | — |

### Recall & Search

| Tool | Description | Parameters |
|------|-------------|------------|
| `kb_recall_context` | Project-first search (task start) | `query`, `maxResults?` |
| `kb_recall_docs` | Personal-first search (docs lookup) | `query`, `maxResults?` |

### Knowledge Enrichment

| Tool | Description | Parameters |
|------|-------------|------------|
| `kb_observe` | Mid-session observation capture | `title`, `content`, `relevance`, `tags?` |
| `kb_enrich` | Merge observation into page | `pageTitle`, `observationTitle`, `observationContent` |
| `kb_retro` | Atomic insight capture | `title`, `body`, `category?` |

### Maintenance

| Tool | Description | Parameters |
|------|-------------|------------|
| `kb_lint` | Health check (orphans, broken links) | `staleDays?` |
| `kb_log_event` | Audit trail entry | `kind`, `data?` |

## Page Types (8)

| Type | Directory | Purpose | Sections |
|------|-----------|---------|----------|
| `concept` | `wiki/concepts/` | Ideas, patterns, explanations | Summary, Key Concepts, Examples, Notes |
| `entity` | `wiki/entities/` | People, orgs, projects | Summary, Key Entities, Key Concepts, Notes |
| `synthesis` | `wiki/syntheses/` | Multi-source summaries | Summary, Key Entities, Key Concepts, Notes |
| `analysis` | `wiki/analyses/` | Comparisons, evaluations | Summary, Key Entities, Key Concepts, Notes |
| `source` | `wiki/sources/` | Raw captured content | Summary, Key Entities, Key Concepts, Notes |
| `meeting` | `wiki/meetings/` | Meeting notes | Summary, Participants, Decisions, Action Items |
| `diary` | `wiki/diaries/` | Daily logs | Summary, Activities, Reflections |
| `artifact` | `wiki/artifacts/` | WIP, brainstorming | Problem, Research, Ideas, Tasks, Implementation, Testing, Notes |

## Examples

### Bootstrap a vault

```bash
# Auto-detect mode (personal if no .git, project if .git exists)
kb_bootstrap topic="My Project Notes"

# Explicit personal mode
kb_bootstrap topic="Personal Knowledge" mode=personal

# Explicit project mode
kb_bootstrap topic="Architecture Decisions" mode=project
```

### Capture a file

```bash
# Capture a text file
kb_capture source=/home/user/docs/architecture.md title="Architecture Notes" type=file

# Capture a PDF (must convert first)
pdftotext /path/to/paper.pdf /tmp/paper.txt
kb_capture source=/tmp/paper.txt title="Research Paper" type=file

# Capture raw text
kb_capture source="## Meeting Notes\n\n- Discussed API design\n- Agreed on REST" title="API Meeting" type=text
```

### Ingest and create pages

```bash
# List pending sources
kb_ingest

# Mark as ingested (auto-ingest does this automatically)
kb_mark_ingested sourceId=SRC-2026-06-29-001

# Create a concept page
kb_ensure_page type=concept title="REST API Design" content="## Overview\n\nREST is..."

# Create an entity page
kb_ensure_page type=entity title="FastAPI" tags=["python","api","framework"]

# Create an artifact (project KB only)
kb_ensure_page type=artifact title="API Redesign Plan" tags=["planning","api"]
```

### Search and recall

```bash
# Search across both vaults (project-first)
kb_recall_context query="authentication patterns"

# Search personal KB first (for docs/reference)
kb_recall_docs query="vue composables"

# Search by tags
kb_search_tags tag="architecture" type=concept
kb_search_tags stage=production
kb_search_tags tag="pinia" type=synthesis
```

### Knowledge enrichment workflow

```bash
# 1. Observe something new
kb_observe title="FastAPI v0.115 breaking change" content="Pydantic v2 required" relevance=high tags=["api","python"]

# 2. Enrich an existing page (inline approval)
kb_enrich pageTitle="FastAPI" observationTitle="FastAPI v0.115 breaking change" observationContent="Pydantic v2 required..."

# 3. Save an atomic insight
kb_retro title="Always pin FastAPI version" body="FastAPI 0.115 broke our auth middleware" category=learning
```

### Health check

```bash
# Show vault status
kb_status

# Run lint checks
kb_lint

# Rebuild metadata registry
kb_rebuild_meta

# Log an event
kb_log_event kind=page_create data="{\"page\": \"my-page\"}"
```

## Settings

```json
{
  "kb": {
    "models": {
      "task": { "provider": "xiaomi-token-plan-sgp", "id": "mimo-v2.5", "thinking": "low", "maxTokens": 4096 },
      "synthesis": { "provider": "xiaomi-token-plan-sgp", "id": "mimo-v2.5-pro", "thinking": "medium", "maxTokens": 8192 },
      "embedding": { "provider": "openrouter", "id": "nvidia/llama-nemotron-embed-vl-1b-v2:free", "dimensions": 1024, "fallback": "qwen/qwen3-embedding-8b" }
    },
    "embeddings": { "enabled": false, "batchSize": 50, "storePath": "meta/embeddings.json" },
    "recall": { "linksThreshold": 50, "maxResults": 5, "hybridWeight": 0.3 },
    "autoIngest": true,
    "autoLint": true,
    "lint": { "staleDays": 30, "warnOnOrphans": true }
  }
}
```

## Vault Structure

```
.kb/
├── config.json           # vault metadata (mode, topic)
├── AGENTS.md             # pointer to skills
├── raw/sources/          # immutable source packets
│   └── SRC-YYYY-MM-DD-NNN/
│       ├── manifest.json
│       ├── original/     # raw file/text
│       └── extracted.md  # markdown content
├── wiki/                 # editable wiki pages
│   ├── concepts/
│   ├── entities/
│   ├── syntheses/
│   ├── analyses/
│   ├── sources/
│   ├── artifacts/        # project vault only
│   ├── meetings/         # personal vault only
│   └── diaries/          # personal vault only
├── meta/                 # auto-generated
│   ├── registry.json     # page index
│   ├── backlinks.json    # link graph
│   ├── events.jsonl      # audit trail
│   └── embeddings.json   # vector embeddings (when enabled)
└── templates/pages/      # page templates
```

## Architecture

```
kb/
├── index.ts              # 15 tool registrations + 3 hooks
├── lib/
│   ├── capture.ts        # source packet creation
│   ├── enrich.ts         # merge observations into pages
│   ├── embeddings.ts     # cosine similarity, hybrid search
│   ├── events.ts         # JSONL audit trail
│   ├── guardrails.ts     # vault protection rules
│   ├── ingest.ts         # source list + mark ingested
│   ├── lint.ts           # wiki health checks
│   ├── metadata.ts       # registry + backlinks rebuild
│   ├── models.ts         # model config loader + API client
│   ├── observe.ts        # mid-session observation capture
│   ├── recall.ts         # wiki search (lexical + semantic)
│   ├── retro.ts          # atomic insight capture
│   ├── templates.ts      # page templates + agents.md
│   └── vault.ts          # vault path resolution
├── templates/pages/      # 8 page type templates
├── skills/
│   ├── kb/SKILL.md       # main reference
│   ├── kb-research/      # web → KB workflow
│   ├── kb-capture-url/   # URL routing workflow
│   ├── kb-bootstrap/     # vault setup workflow
│   └── kb-update/        # enrichment workflow
└── test/                 # 90 tests
```

## Testing

```bash
cd ~/.pi/agent/extensions
vitest run kb
```

## Design

Based on [Karpathy's LLM Wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f):
- **Raw layer**: immutable source packets (captured files, URLs, text)
- **Wiki layer**: editable markdown pages with frontmatter
- **Schema layer**: AGENTS.md pointer + templates
- **Meta layer**: auto-generated registry, backlinks, embeddings
