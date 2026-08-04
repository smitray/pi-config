# KB Tool Reference — All 15 Tools

## Lifecycle

### `kb_bootstrap`
Initialize a new vault. Auto-detects mode unless overridden. Non-destructive.

```text
kb_bootstrap topic="My Project"
kb_bootstrap topic="Personal KB" mode=personal root="/home/user"
```

Parameters:
- `topic` (required): Main topic of the vault
- `mode` (optional): `personal`, `project`, or `auto`. Auto-detects from cwd/git repo status.
- `root` (optional): Override root path (used in auto mode).

Creates `.kb/config.json`, templates, raw/wiki/meta directories.

### `kb_status`
Vault health overview. Returns mode, page counts by type, pending sources, template count.

```text
kb_status
```

## Capture & Ingest

### `kb_capture`
Capture file or text into `raw/sources/` as an immutable source packet.

```text
kb_capture source="/path/to/file.md" title="Architecture Doc"
kb_capture source="raw text here" title="Meeting Notes" type=text
```

Parameters:
- `source` (required): File path or raw text content
- `title` (required): Human-readable title
- `type` (optional): `file`, `text`, or `auto` (default)
- `vault` (optional): `auto`, `personal`, or `project`

After capture, `tool_result` hook auto-ingests and auto-lints if enabled.

### `kb_ingest`
List uningested sources for processing. Returns pending sources with extracted.md paths.

```text
kb_ingest vault=project   # or personal, or auto (default)
```

Process flow: read each source's extracted.md → create wiki pages via `kb_ensure_page` → mark ingested via `kb_mark_ingested`.

### `kb_mark_ingested`
Mark a source as processed. Removes it from pending lists.

```text
kb_mark_ingested sourceId="SRC-2026-06-26-001"
```

Parameters:
- `sourceId` (required): Source ID (format: SRC-YYYY-MM-DD-NNN)

## Pages

### `kb_ensure_page`
Create or update a wiki page with enforced template frontmatter.

```text
kb_ensure_page type=concept title="Async Patterns"
kb_ensure_page type=entity title="FastAPI"
kb_ensure_page type=synthesis title="Auth Architecture"
kb_ensure_page type=artifact title="Sandbox Strategy"
```

Parameters:
- `type` (required): Page type — see [vault types](../SKILL.md#page-types)
- `title` (required): Page title
- `content` (optional): Page body (template provided if omitted)
- `tags` (optional): Tags array (e.g., `["auth", "jwt"]`)
- Various `_tags` fields for artifact sections: `problem_tags`, `research_tags`, `ideas_tags`, `tasks_tags`, `impl_tags`, `testing_tags`, `notes_tags`

Unknown types fall back to `concept`. Template loaded from `.kb/templates/pages/{type}.md`.

Auto-triggers `kb_rebuild_meta` after creation.

## Search

### `kb_recall_context`
Project-first search across both vaults. Use at task start.

```text
kb_recall_context query="auth patterns" maxResults=10
```

With embeddings enabled, uses hybrid search (lexical + semantic). Falls back to lexical-only when disabled.

Parameters:
- `query` (required): Search keywords
- `maxResults` (optional): Default 5, max 100

Includes backlinks and linked pages in results when above `linksThreshold`.

### `kb_recall_docs`
Personal-first search across both vaults. Use for library/docs lookups.

```text
kb_recall_docs query="FastAPI middleware" maxResults=10
```

Same hybrid search as `kb_recall_context` when embeddings enabled.

### `kb_search_tags`
Filter by frontmatter tags, page type, or workflow stage.

```text
kb_search_tags tag="react"
kb_search_tags type=concept stage=production
kb_search_tags tag="python" type=entity stage=draft
```

Parameters:
- `tag` (optional): Frontmatter tag
- `type` (optional): Page type
- `stage` (optional): `brainstorm`, `draft`, `review`, `production`
- `status` (optional): Execution status
- `run` (optional): Run ID filter

## Maintenance

### `kb_lint`
Wiki health check. Returns structured report with warnings and info counts.

```text
kb_lint staleDays=30
```

Reports:
- **Warnings**: Broken wikilinks
- **Info**: Orphan pages, empty pages, stale pages

### `kb_rebuild_meta`
Manually rebuild metadata from wiki pages. Normally auto-triggered after `kb_ensure_page`.

```text
kb_rebuild_meta
```

Rebuilds `registry.json`, `backlinks.json`, and trigger hooks.

## Enrichment

### `kb_observe`
Mid-session observation capture. Lighter than `kb_capture`, timestamped.

```text
kb_observe title="Auth Strategy Update"
           content="JWT refresh tokens can use sliding windows"
           relevance=high
           tags=["auth", "jwt"]
           sourceContext="Discussed during API design review"
```

Parameters:
- `title` (required): Short descriptive title (≤80 chars)
- `content` (required): The observation content
- `relevance` (required): `low`, `medium`, `high`, `critical`
- `tags` (optional): Tags array
- `sourceContext` (optional): What was being worked on

Saved to `wiki/sources/` with `status: observation`.

### `kb_enrich`
Merge an observation into an existing wiki page. Uses synthesis model for intelligent merge.

```text
kb_enrich pageTitle="Auth Strategy"
           observationTitle="Auth Strategy Update"
           observationContent="JWT refresh tokens..."
           sourceContext="Discovered during API design review"
```

Presents inline approval: Merge / Save as observation / Discard. Falls back to simple append if no UI available.

### `kb_retro`
Atomic insight capture — single markdown file, lightweight, no source packet.

```text
kb_retro title="JWT Refresh Token Pattern"
          body="Sliding window refresh avoids..."
          category=learning
```

Categories: `decision`, `learning`, `pattern`, `bug`, `todo`.

### `kb_log_event`
Append to `meta/events.jsonl` audit trail. Each line is self-contained JSON.

```text
kb_log_event kind=page_create data={pageTitle: "...", type: "concept"}
```

Parameters:
- `kind` (required): Event kind (e.g., `ingest`, `page_create`, `lint`)
- `data` (optional): Additional event data object
