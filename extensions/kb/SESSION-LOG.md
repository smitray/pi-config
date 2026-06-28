# KB Extension v2/v3 Development Session

**Date:** 2026-06-29 (02:38 — 04:56)
**Branches:** `feat/kb-extension-v2` → `feat/kb-extension-v3`
**Total Commits:** 51 (v2: 29, v3: 11)
**Tests:** 89 passing

---

## 1. Session Timeline & User Prompts

### Phase 1: Discovery & Planning (02:38 — 03:32)

| Time | User Prompt | Response |
|------|-------------|----------|
| 02:38 | "When did we start creating the KB extension?" | Traced to initial commit 0b6c42e on 2026-06-26 |
| 02:39 | "Find the reference project and initial requirement" | Found Andrej Karpathy's LLM Wiki Gist (April 4, 2026) |
| 02:44 | "Do a feature comparison with upstream pi-llm-wiki" | Identified 6 critical gaps + 8 nice-to-have features |
| 02:51 | "Go through all extensions and make a feature list" | Surveyed gh, guardrails, hooks, web-access, _shared |
| 02:51 | "There is a reason those features weren't implemented yet" | User plans cross-extension reuse |
| 03:00 | "Single URL goes to kb_ingest, web-fetch-docs for multi-page" | Defined URL/docs ingestion workflow |
| 03:11 | "When new info found about existing KB topic, should it be added in background?" | Designed semi-auto enrichment workflow |
| 03:23 | "Personal KB is at ~/.kb, project KB in project root" | Defined vault routing rules |
| 03:23 | "Use rpiv-ask-user-question for ambiguous routing" | Added user confirmation for edge cases |
| 03:26 | "Skills need to be added for each functionality" | Planned 4 SKILL.md files |
| 03:32 | "Work in worktree/new branch, feature-based tests, commit after every feature" | Established development workflow |

### Phase 2: Core Implementation (03:35 — 03:54)

| Time | User Prompt | Response |
|------|-------------|----------|
| 03:35 | "Add registration API" (for guardrails) | Implemented guardrails/api.ts with registerRules() |
| 03:37 | — | Shared result helpers (_shared/result.ts) |
| 03:37 | — | KB migration to shared ok()/err() |
| 03:40 | — | kb_rebuild_meta tool |
| 03:40 | — | Phase 1.2 marked N/A (hooks can't run Pi tools) |
| 03:41 | — | PLAN.md moved to extensions/kb/ |
| 03:42 | — | kb_lint tool (orphan, broken links, empty, stale) |
| 03:43 | — | kb_observe tool |
| 03:44 | — | kb_retro tool |
| 03:45 | — | kb_log_event tool |

### Phase 3: Integration & Skills (03:50 — 03:59)

| Time | User Prompt | Response |
|------|-------------|----------|
| 03:50 | — | Vault routing in kb_capture |
| 03:51 | — | Skill files (kb-ingest, kb-enrich, kb-lint) |
| 03:52 | — | Markdown chunking via web-access |
| 03:52 | — | HTML normalization |
| 03:54 | "I don't think you needed this capture.ts" | Confirmed web-access handles HTML → reverted |
| 03:57 | "Pause Phase 5, read through all extensions" | Created EXTENSIONS.md reference guide |
| 03:59 | — | Phase 5 marked N/A (hooks limitation) |

### Phase 4: Auto-processing & Enrichment (04:02 — 04:15)

| Time | User Prompt | Response |
|------|-------------|----------|
| 04:02 | — | Cross-extension integration verification |
| 04:06 | — | Realized Phase 5 blocker was wrong |
| 04:08 | "Use _shared/spawn.ts whenever needed" | Implemented auto-ingest via tool_result hook |
| 04:11 | "Go ahead" | Implemented kb_enrich tool |
| 04:14 | "Why are Phase 7/8 deferred?" | Explained YAGNI + VRAM constraints |
| 04:15 | — | PR created, feat/kb-extension-v3 branch |

### Phase 5: Model Configuration (04:22 — 04:56)

| Time | User Prompt | Response |
|------|-------------|----------|
| 04:22 | "Add model and parameter configuration to settings.json" | Started brainstorming |
| 04:25 | "Check @models.json for available models" | Read user's models.json |
| 04:31 | "What's the difference between Nemotron and Qwen3?" | Compared embedding models |
| 04:34 | "Those are text-text only, not multimodal" | User corrected about Laguna models |
| 04:39 | "I have xiaomi token plan and minimax token plan" | Finalized model selection |
| 04:41 | "Approved, but create implementation plan first" | Created MODEL-PLAN.md |
| 04:47 | "yes" (continue) | Implemented all 8 tasks |

---

## 2. Findings & Solutions

### Finding 1: Upstream pi-llm-wiki Has 6 Critical Gaps

**Problem:** The upstream zosmaai/pi-llm-wiki extension had issues:
1. Templates not enforced
2. wiki_bootstrap always defaults to personal mode
3. Raw directory misrouting between vaults
4. Search is title-only not tag-aware
5. '[sources' folder bug from wikilink parsing
6. Templates created but ignored

**Solution:** Built KB extension from scratch instead of wrapping upstream.

---

### Finding 2: Cross-Extension Reuse Opportunities

**Problem:** Extensions duplicated logic:
- gh/lib/result.ts and web-access/lib/result.ts had identical ok()/err() helpers
- KB's guardrails duplicated the tool_call hook pattern

**Solution:**
- Created `_shared/result.ts` consolidating ok()/err() helpers
- Created `guardrails/api.ts` with `registerRules()` API for dynamic rule registration
- KB imports from _shared and guardrails instead of duplicating

---

### Finding 3: Hooks Extension Limitation

**Problem:** Phase 5 planned to use hooks extension for auto-triggering ingest/lint after capture. But hooks extension runs shell commands only, not Pi tools.

**Solution:** Extended KB's own `tool_result` hook to run ingest logic in-process after `kb_capture`. No shell wrapper needed.

---

### Finding 4: HTML Normalization Was Redundant

**Problem:** Phase 3.2 added HTML normalization to capture.ts. User pointed out web-access already handles this.

**Investigation:** web-fetch.ts calls Crawl4AI's `/md` endpoint which returns markdown directly. HTML never reaches KB's capture pipeline.

**Solution:** Reverted HTML normalization (isHtml/htmlToMarkdown functions). Marked Phase 3.2 as N/A.

---

### Finding 5: VRAM Constraints Affect Model Choices

**Problem:** User has RTX 3050 4GB, VRAM-sensitive. Local embedding models consume GPU memory.

**Solution:** Use OpenRouter free models for embedding (NVIDIA Nemotron Embed VL 1B V2:free) with fallback to Qwen3 8B. No local model loading needed.

---

### Finding 6: Vault Routing Rules

**Discovery:** User clarified routing logic:
- **Personal KB** (~/.kb): Library docs, meeting notes, personal knowledge
- **Project KB** (project root): Artifacts, WIP, project-specific docs
- **Default:** Project KB for everything else
- **Ambiguous:** Use ask_user_question for confirmation

---

## 3. Feature Stages & Status

### Phase 1: Cross-Extension Integration ✅ COMPLETE

| Task | Status | Commit | Description |
|------|--------|--------|-------------|
| 1.1 Guardrails API | ✅ | 0c2c82a | `guardrails/api.ts` with `registerRules()` and `getDynamicGroups()` |
| 1.2 Metadata via Hooks | N/A | — | Hooks extension runs shell commands only, not Pi tools |
| 1.3 Shared Result Format | ✅ | 3b1a4e3 | `_shared/result.ts` with `ok()`/`err()` helpers |

### Phase 2: URL & Document Ingestion ⏳ PARTIAL

| Task | Status | Commit | Description |
|------|--------|--------|-------------|
| 2.1 Vault Routing | ✅ | 59be5de | `vault` parameter on kb_capture (personal/project/auto) |
| 2.2 Single URL Ingest | ⏳ | — | Planned: web-fetch → kb_capture pipeline |
| 2.3 Multi-page Docs Ingest | ⏳ | — | Planned: web-fetch-docs → batch kb_capture |

### Phase 3: Source Extraction ✅ COMPLETE

| Task | Status | Commit | Description |
|------|--------|--------|-------------|
| 3.1 Markdown Chunking | ✅ | b27fbf7 | Reuses `approxTokens()` + `splitIntoChunks()` from web-access |
| 3.2 HTML Normalization | N/A | — | web-fetch already returns markdown via Crawl4AI |

### Phase 4: Core Features ✅ COMPLETE

| Task | Status | Commit | Description |
|------|--------|--------|-------------|
| 4.1 kb_rebuild_meta | ✅ | 1ef0d6f | Manual metadata rebuild tool |
| 4.2 kb_lint | ✅ | 26d9cbc | Orphan, broken links, empty, stale page detection |
| 4.3 kb_observe | ✅ | 1589f6a | Mid-session timestamped observations |
| 4.4 kb_retro | ✅ | a8c7eb1 | Atomic insight capture |
| 4.5 kb_log_event | ✅ | 85cfd86 | Audit trail (JSONL) |

### Phase 5: Background Processing ✅ COMPLETE

| Task | Status | Commit | Description |
|------|--------|--------|-------------|
| 5.1 Auto-ingest | ✅ | 8070627 | tool_result hook auto-ingests after kb_capture |
| 5.2 Auto-lint | ✅ | 8070627 | lintWiki() runs after ingest |

### Phase 6: Knowledge Enrichment ✅ COMPLETE

| Task | Status | Commit | Description |
|------|--------|--------|-------------|
| 6.1 kb_enrich | ✅ | c24ffda | Merge observation into existing wiki page |

### Phase 7: Semantic Search ⏸️ DEFERRED

| Task | Status | Reason |
|------|--------|--------|
| 7.1 Embedding generation | ⏸️ | Needs API integration (models now configured) |
| 7.2 Hybrid search | ⏸️ | Code ready, needs embedding pipeline |

### Phase 8: Agent Memory ⏸️ DEFERRED

| Task | Status | Reason |
|------|--------|--------|
| 8.1 Session logging | ⏸️ | YAGNI — om_recall covers session continuity |
| 8.2 Trajectories | ⏸️ | Nice-to-have |
| 8.3 Skill distillation | ⏸️ | Nice-to-have |

### Model Configuration ✅ COMPLETE (v3)

| Task | Status | Commit | Description |
|------|--------|--------|-------------|
| 1. Model Config Loader | ✅ | b151319 | `lib/models.ts` with defaults and validation |
| 2. API Client | ✅ | a3a21ec | `complete()` + `embed()` with retry |
| 3. Embedding Storage | ✅ | df7790d | Store/load/remove embeddings |
| 4. Embedding Search | ✅ | fea81ad | `cosineSimilarity()` + `hybridSearch()` |
| 5. kb_enrich AI | ✅ | 33c997d | `enrichWithAI()` using synthesis model |
| 6. kb_ingest AI | ✅ | 45bd5ae | `synthesizeWithAI()` using task model |
| 7. kb_recall hybrid | ✅ | 961cd16 | `searchWiki()` with hybrid re-ranking |
| 8. Settings Schema | ✅ | 7bd5f07 | Model config for task/synthesis/embedding |

### Skills ✅ COMPLETE

| Skill | Status | Commit | Description |
|-------|--------|--------|-------------|
| kb-ingest | ✅ | 6670d17 | URL/docs ingestion workflows |
| kb-enrich | ✅ | 6670d17 | Observe/review/integrate workflow |
| kb-lint | ✅ | 6670d17 | Health checks and maintenance |
| kb (main) | ⏳ | — | Main KB skill file (pending) |

---

## 4. Current State

### KB Extension Tools (15 total)

| Tool | Phase | Description |
|------|-------|-------------|
| `kb_bootstrap` | Initial | Initialize KB vault |
| `kb_ensure_page` | Initial | Create/update wiki page from template |
| `kb_capture` | Initial | Capture source into raw/sources/ |
| `kb_ingest` | Initial | List uningested sources |
| `kb_recall_context` | Initial | Search wiki (project-first) |
| `kb_recall_docs` | Initial | Search wiki (personal-first) |
| `kb_mark_ingested` | Initial | Mark source as processed |
| `kb_status` | Initial | Show vault status |
| `kb_search_tags` | Initial | Search by tag/type/stage |
| `kb_rebuild_meta` | Phase 4 | Manual metadata rebuild |
| `kb_lint` | Phase 4 | Wiki health checks |
| `kb_observe` | Phase 4 | Mid-session observations |
| `kb_retro` | Phase 4 | Atomic insight capture |
| `kb_log_event` | Phase 4 | Audit trail |
| `kb_enrich` | Phase 6 | Merge observation into page |

### New Lib Modules (v3)

| Module | Description |
|--------|-------------|
| `lib/models.ts` | Model config loader + API client (complete/embed) |
| `lib/embeddings.ts` | Embedding storage + cosine/hybrid search |
| `lib/enrich.ts` | AI-powered enrichment (synthesis model) |
| `lib/ingest.ts` | AI-powered source synthesis (task model) |
| `lib/recall.ts` | Hybrid search integration |

### Settings Configuration

```json
{
  "kb": {
    "models": {
      "task": {
        "provider": "xiaomi-token-plan-sgp",
        "id": "mimo-v2.5",
        "thinking": "low",
        "maxTokens": 4096
      },
      "synthesis": {
        "provider": "xiaomi-token-plan-sgp",
        "id": "mimo-v2.5-pro",
        "thinking": "medium",
        "maxTokens": 8192
      },
      "embedding": {
        "provider": "openrouter",
        "id": "nvidia/llama-nemotron-embed-vl-1b-v2:free",
        "dimensions": 1024,
        "fallback": "qwen/qwen3-embedding-8b"
      }
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

---

## 5. Remaining Work

### Immediate (Phase 2.2/2.3)
- [ ] Single URL ingestion pipeline (web-fetch → kb_capture)
- [ ] Multi-page docs ingestion (web-fetch-docs → batch capture)
- [ ] YouTube transcript ingestion (blocked: STT model needed)

### When Vault Hits 1000+ Pages (Phase 7)
- [ ] Enable embeddings in settings (`embeddings.enabled: true`)
- [ ] Embedding generation pipeline (batch re-embed on model change)
- [ ] Hybrid search performance tuning

### Nice-to-Have (Phase 8)
- [ ] Session logging per vault
- [ ] Agent trajectories capture
- [ ] Skill distillation from trajectories

### Skills
- [ ] Main `kb` SKILL.md (overview of all KB operations)

---

## 6. Key Decisions

1. **Built from scratch** instead of wrapping upstream pi-llm-wiki (6 critical gaps)
2. **Cross-extension reuse** over duplication (_shared/result.ts, guardrails/api.ts)
3. **In-process hooks** over shell commands (tool_result hook for auto-ingest)
4. **Deferred semantic search** until vault is larger (YAGNI + VRAM constraints)
5. **MiMo V2.5** for task model (multimodal, 1M context, $0.40/M)
6. **MiMo V2.5 Pro** for synthesis (best reasoning, $1/M)
7. **NVIDIA Nemotron free** for embedding (131K context, 1024 dims)
8. **ask_user_question** for ambiguous vault routing (not hardcoded rules)
