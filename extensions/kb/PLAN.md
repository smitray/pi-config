# KB Extension — Feature & Task Plan

**Date:** 2026-06-29  
**Status:** In Progress  
**Principle:** Cross-extension composition over duplication

> **⚠️ TODO: Delete this file once all phases are complete.** This is a working plan, not permanent documentation.

---

## Vault Routing Rules

| Content Type | Target Vault | Notes |
|--------------|--------------|-------|
| Library docs (React, Pinia, Hyprland, etc.) | **Personal** (`~/.kb/`) | Default for web-access fetched docs |
| Meeting notes | **Personal** | Personal stuff |
| Artifacts (WIP, project workflow docs) | **Project** (`.kb/`) | Project-scoped only |
| Everything else | **Project** | Default for project work |
| Ambiguous | **Ask user** | Use `ask_user_question` |

**Ambiguity resolution:** When vault is unclear, use `ask_user_question` with options:
- "Save to personal KB (library docs, notes)"
- "Save to project KB (artifacts, WIP)"

---

## Feature List

### Phase 1: Cross-Extension Integration (Reduce Duplication)

| # | Feature | Description | Extension Used |
|---|---------|-------------|----------------|
| 1.1 | **Guardrails via guardrails ext** | Move kb's `installGuardrails()` to register rules with the `guardrails` extension instead of inline `tool_call` hook | `guardrails` | ✅ Done |
| 1.2 | **Metadata rebuild via hooks** | ~~Move `tool_result` auto-rebuild to `hooks` extension~~ N/A — hooks extension runs shell commands, not Pi tools. KB's `tool_result` hook is already clean and lightweight. | `hooks` | ✅ Kept as-is |
| 1.3 | **Tool result format** | Adopt shared `ok()`/`err()` pattern from `_shared/result.ts` | `_shared` | ✅ Done |

### Phase 2: URL & Document Ingestion (Web-Access Integration)

| # | Feature | Description | Extension Used |
|---|---------|-------------|----------------|
| 2.1 | **Single URL → KB ingest** | `web-fetch` URL → write to temp → `kb_capture` → `kb_ingest` pipeline. Auto-route to personal KB for docs | `web-access` |
| 2.2 | **Multi-page docs ingest** | `web-fetch-docs` crawl → capture each page into `raw/sources/` → batch ingest. For library documentation → personal KB | `web-access` |
| 2.3 | **YouTube transcript ingest** | `media-transcribe` → `kb_capture`. Blocked until STT model available | `web-access` |

### Phase 3: Source Extraction Improvements

| # | Feature | Description | Extension Used |
|---|---------|-------------|----------------|
| 3.1 | **Markdown chunking** | Reuse `approxTokens()` and `splitIntoChunks()` from `web-access/lib/markdown.ts` for large source extraction | `web-access` |
| 3.2 | **HTML normalization** | Handle HTML content in captures (convert to markdown) | `web-access` |

### Phase 4: Missing Core Features

| # | Feature | Description | Priority |
|---|---------|-------------|----------|
| 4.1 | **`kb_rebuild_meta` tool** | Manual trigger to rebuild registry + backlinks. Needed for cross-extension hooks | HIGH |
| 4.2 | **`kb_lint` tool** | Health checks: orphan pages, broken wikilinks, missing cross-references, contradictions | HIGH |
| 4.3 | **`kb_observe` tool** | Mid-session observation capture. Lightweight write to `wiki/sources/` with `status: observation`. Used for enrichment workflow | MED |
| 4.4 | **`kb_retro` tool** | Atomic insight capture at task end. Single markdown file, no source packet overhead | MED |
| 4.5 | **`kb_log_event` tool** | Append events to `meta/events.jsonl` for audit trail | LOW |

### Phase 5: Background Processing

| # | Feature | Description | Extension Used |
|---|---------|-------------|----------------|
| 5.1 | **Background ingest** | Spawn sub-agent for ingest synthesis (read extracted.md → generate wiki pages). Uses `_shared/spawn.ts` pattern | `_shared` |
| 5.2 | **Auto-trigger ingest** | After `kb_capture`, auto-queue ingest via `hooks` extension `tool_result` event | `hooks` |
| 5.3 | **Background lint** | Run lint after ingest completes (chained via hooks) | `hooks` |

### Phase 6: Knowledge Enrichment (Semi-Auto)

| # | Feature | Description | Priority |
|---|---------|-------------|----------|
| 6.1 | **Enrichment detection** | When new info found about existing KB topic during discussion, flag it | HIGH |
| 6.2 | **`ask_user_question` integration** | Ask user: "Update existing page [X] with this new info?" Options: [Yes, update] [Save as observation] [Discard] | HIGH |
| 6.3 | **Observation → page integration** | If approved, merge observation content into canonical page | MED |

### Phase 7: Semantic Search (Deferred)

| # | Feature | Description | Priority |
|---|---------|-------------|----------|
| 7.1 | **Embeddings** | Background-computed vectors per page. Deferred — lexical search sufficient at current scale (<100 pages) | LOW |
| 7.2 | **Hybrid search** | Blend lexical + semantic cosine. Add when vault hits 1000+ pages | LOW |

### Phase 8: Agent Memory Features (Deferred)

| # | Feature | Description | Priority |
|---|---------|-------------|----------|
| 8.1 | **Session logging** | Auto-log agent sessions via `hooks` extension `session_start/shutdown` events | LOW |
| 8.2 | **Trajectories** | Capture agent tool-call sequences as working memory | LOW |
| 8.3 | **Skill distillation** | Turn trajectories into reusable skill pages | LOW |

---

## Skills

Each major workflow gets its own skill file. Skills are loaded via `resources_discover` event.

| Skill | Path | Purpose |
|-------|------|---------|
| **kb** | `skills/kb/SKILL.md` | Main KB skill — all tools, vault structure, templates |
| **kb-ingest** | `skills/kb-ingest/SKILL.md` | URL/docs ingestion workflows — web-access integration |
| **kb-enrich** | `skills/kb-enrich/SKILL.md` | Knowledge enrichment — observe, review, integrate workflow |
| **kb-lint** | `skills/kb-lint/SKILL.md` | Health checks — lint, rebuild, maintenance workflows |

### Skill: kb-ingest

**Triggers:** "fetch docs", "ingest URL", "add to KB", "capture page", "library docs"

**Content:**
- Single URL → KB workflow (`web-fetch` → `kb_capture`)
- Multi-page docs workflow (`web-fetch-docs` → batch `kb_capture`)
- YouTube transcript workflow (blocked, document for later)
- Vault routing rules (personal for docs, project for artifacts)
- `ask_user_question` for ambiguous cases
- Examples for each workflow

### Skill: kb-enrich

**Triggers:** "update KB", "enrich", "new info about", "observation", "review observations"

**Content:**
- Enrichment detection pattern (when new info found about existing topic)
- `kb_observe` usage for mid-session captures
- `ask_user_question` for approval workflow
- Observation → page integration pattern
- Examples: "We found new info about auth strategy, should I update the page?"

### Skill: kb-lint

**Triggers:** "health check", "lint", "KB status", "orphan pages", "broken links", "rebuild meta"

**Content:**
- `kb_lint` usage for health checks
- `kb_rebuild_meta` for manual metadata rebuild
- `kb_status` for vault overview
- When to run lint (after ingest, periodically, on demand)
- Examples for each maintenance workflow

---

## Task List

### Phase 1: Cross-Extension Integration

- [x] **1.1** Refactor kb guardrails to use `guardrails` extension
  - [x] Remove `extensions/kb/lib/guardrails.ts` inline hook
  - [x] Register kb raw/meta protection rules with guardrails extension
  - [x] Test: verify writes to `.kb/raw/` and `.kb/meta/` still blocked

- [x] **1.2** Metadata rebuild hook — N/A (hooks ext runs shell commands, not Pi tools. KB's `tool_result` hook is already clean)

- [x] **1.3** Adopt shared tool result format
  - [x] Import `ok()`/`err()` from `_shared/result.ts`
  - [x] Update all kb tool handlers to use consistent format
  - [x] Test: verify all tools return proper `{ content, details, isError }`

### Phase 2: URL & Document Ingestion

- [x] **2.1** Single URL → KB workflow
  - [x] Add `vault` parameter to `kb_capture` (personal/project/auto)
  - [ ] Implement `ask_user_question` for ambiguous vault routing
  - [x] Document workflow in `skills/kb-ingest/SKILL.md`
  - [ ] Test end-to-end with a real URL

- [ ] **2.2** Multi-page docs ingest workflow
  - [ ] Add `vault` parameter to `kb_capture` (default: personal for docs)
  - [x] Document workflow: `web-fetch-docs` → iterate → `kb_capture` each
  - [ ] Test with a small docs site (3-5 pages)

- [ ] **2.3** YouTube transcript ingest (blocked)
  - [x] Document planned workflow in `skills/kb-ingest/SKILL.md`
  - [ ] Mark as blocked: STT model not available
  - [ ] Unblock when STT model lands

### Phase 3: Source Extraction

- [x] **3.1** Add markdown chunking for large sources
  - [x] Import `approxTokens()` and `splitIntoChunks()` from `web-access/lib/markdown.ts`
  - [x] Use in `kb_capture` when extracted content exceeds token threshold
  - [x] Test: capture a large document, verify chunking

- [x] **3.2** HTML normalization in captures
  - [x] ~~Detect HTML content in source text~~ N/A — `web-fetch` already returns markdown via Crawl4AI
  - [x] ~~Convert to markdown before writing `extracted.md`~~ N/A — Crawl4AI handles this
  - [x] Test: capture raw HTML, verify clean markdown output

### Phase 4: Missing Core Features

- [x] **4.1** Add `kb_rebuild_meta` tool
  - [x] Register tool in kb index.ts
  - [x] Expose existing `rebuildMetadata()` from `lib/metadata.ts`
  - [x] Test: manual rebuild, verify registry + backlinks updated

- [x] **4.2** Add `kb_lint` tool
  - [x] Check for orphan pages (no inbound wikilinks)
  - [x] Check for broken wikilinks (target page doesn't exist)
  - [x] Check for empty pages (no content beyond frontmatter)
  - [x] Check for stale pages (not updated in N days)
  - [x] Return lint report as structured output
  - [x] Test: create wiki with known issues, verify lint catches them
  - [x] Document in `skills/kb-lint/SKILL.md`

- [x] **4.3** Add `kb_observe` tool
  - [x] Write observation to `wiki/sources/` with `type: source`, `status: observation`
  - [x] Accept title, content, relevance level, tags
  - [x] Test: observe something, verify searchable via `kb_recall_*`
  - [x] Document in `skills/kb-enrich/SKILL.md`

- [x] **4.4** Add `kb_retro` tool
  - [x] Write single markdown file to `wiki/sources/` (no source packet)
  - [x] Accept title, body, category
  - [x] Test: save insight, verify searchable

- [x] **4.5** Add `kb_log_event` tool
  - [x] Append JSONL entry to `meta/events.jsonl`
  - [x] Accept event kind, data payload
  - [x] Test: log event, verify file updated

### Phase 5: Background Processing

- [x] **5.1** Auto-ingest after capture
  - [x] Extended `tool_result` hook in kb/index.ts
  - [x] After `kb_capture`, reads `extracted.md` and creates wiki page
  - [x] Marks source as ingested
  - [x] Logs event to `meta/events.jsonl`

- [x] **5.2** Auto-trigger ingest after capture
  - [x] Implemented via `tool_result` hook (in-process, not shell)
  - [x] No need for hooks extension — KB handles its own events

- [x] **5.3** Auto-lint after ingest
  - [x] Runs `lintWiki()` after ingest completes
  - [x] Logs warnings if any found

### Phase 6: Knowledge Enrichment

- [ ] **6.1** Enrichment detection pattern
  - [ ] During discussion, detect when new info relates to existing KB topic
  - [ ] Use `kb_recall_context` to check if topic exists in KB
  - [ ] If match found, trigger enrichment workflow
  - [ ] Document detection pattern in `skills/kb-enrich/SKILL.md`

- [ ] **6.2** `ask_user_question` for enrichment approval
  - [ ] When enrichment detected, ask user: "Update existing page [X]?"
  - [ ] Options: [Yes, update] [Save as observation] [Discard]
  - [ ] Route to appropriate action based on user choice
  - [ ] Document workflow in `skills/kb-enrich/SKILL.md`

- [ ] **6.3** Observation → page integration
  - [ ] If user approves, merge observation content into canonical page
  - [ ] Preserve original observation as source reference
  - [ ] Update page frontmatter (updated date, sources)
  - [ ] Test: approve enrichment, verify page updated

### Phase 7: Semantic Search (Deferred)

- [ ] **7.1** Embeddings
  - [ ] Design: background-computed vectors stored in `meta/embeddings.json`
  - [ ] Implement when vault hits 100+ pages
  - [ ] Blocked: YAGNI at current scale

- [ ] **7.2** Hybrid search
  - [ ] Blend lexical + semantic cosine similarity
  - [ ] Implement after 7.1
  - [ ] Blocked: needs embeddings first

### Phase 8: Agent Memory (Deferred)

- [ ] **8.1** Session logging via hooks
  - [ ] Use `hooks` extension `session_start/shutdown` events
  - [ ] Log to `meta/session-log.jsonl`
  - [ ] Implement when needed

- [ ] **8.2** Trajectories
  - [ ] Capture tool-call sequences as source packets
  - [ ] Implement when workflow complexity warrants it

- [ ] **8.3** Skill distillation
  - [ ] Turn trajectories into reusable skill pages
  - [ ] Implement after 8.2

---

## Task Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1: Cross-Extension Integration | 3 features, 9 subtasks | ✅ Done |
| Phase 2: URL & Document Ingestion | 3 features, 7 subtasks | Partial (2.1 done) |
| Phase 3: Source Extraction | 2 features, 5 subtasks | Not started |
| Phase 4: Missing Core Features | 5 features, 15 subtasks | ✅ Done |
| Phase 5: Background Processing | 3 features, 6 subtasks | ✅ Done |
| Phase 6: Knowledge Enrichment | 3 features, 8 subtasks | Not started |
| Phase 7: Semantic Search | 2 features | Deferred |
| Phase 8: Agent Memory | 3 features | Deferred |
| Skills | 4 skill files | ✅ Done (3/4) |

**Immediate focus:** Phase 3 + Phase 5

---

*Plan created: 2026-06-29*
*Updated: 2026-06-29 — Added vault routing rules, enrichment workflow, skills*
