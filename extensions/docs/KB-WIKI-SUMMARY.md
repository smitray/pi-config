# KB / LLM-Wiki — Consolidated Summary

> Single source of truth: requirements, progress, review findings, and gaps.
> Supersedes: EXTENSIONS.md, MODEL-PLAN.md, PLAN.md, SESSION-LOG.md, pi-llm-wiki-deep-dive.md,
> session-2026-06-23-llm-wiki-discussion.md, session-2026-06-27-kb-status-extraction.md,
> sessions-2026-06-24.md, wiki-orchestrator-strategic-plan.md.

---

## 1. Requirements

### 1.1 What the user needed

A personal + project knowledge base integrated with pi, inspired by Andrej Karpathy's LLM Wiki pattern.

**Personal vault** (`~/.kb/`):
- Library documentation ingestion (web fetch → raw → wiki pages)
- Daily routine, schedule, health, meetings, followups
- Learning goals and content management

**Project vault** (`.kb/` at project root):
- GitHub repo reference for code context
- Project progress tracking
- Multi-stage artifact management (brainstorm → draft → review → production)

### 1.2 Six critical gaps in upstream (pi-llm-wiki)

| # | Gap | Impact |
|---|-----|--------|
| 1 | Templates exist but not enforced | No page structure consistency |
| 2 | `wiki_bootstrap` always defaults to "personal" | Project vaults misconfigured at init |
| 3 | Raw directory misrouting between vaults | Sources leak to wrong vault |
| 4 | Search is title-only, not tag-aware | Can't filter by tag, type, or stage |
| 5 | `[sources` folder bug | Pollutes filesystem from wikilink parsing |
| 6 | Templates created but ignored (duplicate of #1) | Inert artifacts |

### 1.3 Key architectural decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Build vs fork | Build from scratch | 6 critical gaps made wrapping infeasible |
| Vault routing | Auto-detect (project/personal) + explicit override | `.git/` or `package.json` → project mode |
| Search | Hybrid: lexical (TF-IDF) + semantic (embeddings, opt-in) | TF-IDF works for technical docs; embeddings when vault grows |
| Model integration | Task/synthesis/embedding models via `settings.json` | MiMo V2.5 for ingest, MiMo V2.5 Pro for synthesis, Nemotron for embeddings |
| Page types | 8 types: concept, entity, synthesis, analysis, source, meeting, diary, artifact | Covers both knowledge management and artifact lifecycle |
| Artifact lifecycle | 7 section-tag arrays + stage field (brainstorm→production) | Supports multi-stage subagent pipelines |

---

## 2. Progress

### 2.1 What was built

**KB Extension** — 15 tools, 14 lib modules, 5 skills, 8 templates:

| Area | Status | Details |
|------|--------|---------|
| Bootstrap | ✅ | Dual-mode auto-detection, 3-choice AGENTS.md generation |
| 8 page templates | ✅ | Enforced frontmatter on every `kb_ensure_page` call |
| Capture pipeline | ✅ | File/text → immutable source packet (raw/sources/) |
| Ingest workflow | ✅ | Two-step: capture → read extracted.md → create wiki pages |
| Recall (dual-mode) | ✅ | `kb_recall_context` (project-first), `kb_recall_docs` (personal-first) |
| Tag search | ✅ | `kb_search_tags` by tag, type, workflow stage |
| Vault routing | ✅ | Auto-detect via resolveVaultContext, explicit vault parameter |
| Rebuild meta | ✅ | Manual `kb_rebuild_meta` + auto-trigger on wiki edits |
| Lint | ✅ | Orphan pages, broken wikilinks, empty/stale pages |
| Observe/Retro | ✅ | Mid-session observations, end-of-task insights |
| Enrichment | ✅ | Merge observation into page with user approval |
| Event logging | ✅ | Audit trail via `meta/events.jsonl` |
| Cross-extension reuse | ✅ | `_shared/result.ts`, `guardrails/api.ts`, web-access chunking |
| Model config | ✅ | Task/synthesis/embedding models in `settings.json` |
| Hybrid search | ✅ | Lexical + semantic blend (embeddings opt-in, disabled by default) |
| Session logging | ✅ | Via pi-observational-memory (om-recall skill) |

### 2.2 Extension ecosystem (6 extensions)

| Extension | Tools | Lines | Status |
|-----------|-------|-------|--------|
| `gh` | 17 | ~400 | ✅ 6 tool files, consistent error handling |
| `guardrails` | — | ~300 | ✅ Token matcher, dynamic API, 3 default groups |
| `hooks` | — | ~250 | ✅ Shell hooks on 5 lifecycle events |
| `kb` | 15 | ~2000 | ✅ Largest extension, full KB lifecycle |
| `web-access` | 8 | ~1500 | ✅ Crawl4AI, TF-IDF docs, yt-dlp media |
| `_shared` | — | ~120 | ✅ spawn.ts + result.ts used by 3 extensions |

### 2.3 Tests

| Extension | Tests | Status |
|-----------|-------|--------|
| gh | 3 files | ✅ |
| guardrails | 4 files | ✅ |
| hooks | 2 files | ✅ |
| kb | 10 files | ✅ 89+ passing |
| web-access | 4 files | ✅ |
| _shared | 1 file | ✅ |

---

## 3. Review Findings

### 3.1 Code quality highlights

| What | Where | Note |
|------|-------|------|
| ✅ Consistent error handling | All tools | `ok()`/`err()` from `_shared/result.ts` (kb), duplicated in gh and web-access |
| ✅ Ponytail compliance | Throughout | Named ceilings, documented shortcuts, no speculative abstractions |
| ✅ Token-based command matching | guardrails/matcher.ts | Handles `bash -c "..."`, env vars, pipeline segments |
| ✅ Auto-SIGKILL escalation | _shared/spawn.ts | SIGTERM → 5s grace → SIGKILL |
| ✅ Dynamic guardrails API | guardrails/api.ts | `registerRules()` lets kb register raw/meta protection |
| ✅ 15 tools with promptSnippet | kb/index.ts | LLM self-discovers tools via prompt guidelines |
| ✅ TF-IDF with ceiling comment | web-access/lib/docs-store.ts | "Ponytail choice: no embedding service" |

### 3.2 Known issues

| Severity | Issue | File |
|----------|-------|------|
| 🟡 | `lib/result.ts` duplicated in gh and web-access — should import from `_shared` | `gh/lib/result.ts`, `web-access/lib/result.ts` |
| 🟡 | `kb-packets.ts` duplicates kb's capture.ts logic (source ID, manifest format) | `web-access/lib/kb-packets.ts` |
| 🟡 | `kb/index.ts` is 500+ lines with all 15 tools inline | `kb/index.ts` |
| 🟢 | No `gh auth status` check on load — fails silently at first call | All gh tools |
| 🟢 | markdown-it.ts chunkByHeadings is 120+ lines, unused for actual splitting | `web-access/lib/markdown-it.ts` |
| 🟢 | Hooks config is hardcoded in index.ts — no file-based loading | `hooks/index.ts` |

### 3.3 Architecture notes

```
         pi agent
            │
    ┌───────┼───────────┬───────────────┐
    │       │           │               │
    gh   guardrails   hooks        web-access
    │       │                       │       │
    └─── _shared (spawn, result) ───┘       │
                                            │
                                          kb (15 tools)
                                            │
                                       .kb/ vault
```

---

## 4. Gaps

### 4.1 Not built (deferred / pending)

| Gap | Reason | Unblock condition |
|-----|--------|-------------------|
| Single URL ingestion pipeline | Deferred | web-fetch → kb_capture skill not authored |
| Multi-page docs ingestion | Deferred | web-fetch-docs kbRoot parameter exists, skill not authored |
| YouTube transcript ingestion | Blocked | STT model not available (4GB VRAM) |
| Embeddings enabled by default | Deferred | Enable when vault hits 1000+ pages |
| Session trajectories | Deferred | YAGNI — om-recall covers continuity |
| Skill distillation from trajectories | Deferred | YAGNI — need trajectories first |

### 4.2 Code quality debt

| Debt | Where | Tracked |
|------|-------|---------|
| `lib/result.ts` duplication (gh, web-access) | 2 files | Known, cross-extension import not done |
| `kb-packets.ts` duplication | 1 file | "~60 lines, add when KB exposes a capture library API" |
| No spawn.ts tests | `_shared/test/` | Tested through consumer extensions |
| Hooks config hardcoded, no file loading | `hooks/index.ts` | Ponytail: empty default, user adds what they need |

### 4.3 Feature wishlist

| Feature | Priority | Notes |
|---------|----------|-------|
| gh auth check on load | Low | Silently fails, but error messages are clear |
| hooks config from disk | Low | Hardcoded works for current usage |
| Embedding provider auto-discovery | Low | Requires OpenRouter API key |
| Cross-vault synthesis tool | Medium | "Compare project X knowledge with personal docs" |
| Web dashboard output | Low | `kb_status` could emit JSON for external dashboards |

---

## 5. Reference

### 5.1 Key files

| Path | Purpose |
|------|---------|
| `extensions/kb/index.ts` | 15 tool registrations + lifecycle hooks |
| `extensions/kb/lib/vault.ts` | Vault path resolution, routing |
| `extensions/kb/lib/capture.ts` | File/text → source packet |
| `extensions/kb/lib/models.ts` | Model config + API client |
| `extensions/kb/lib/recall.ts` | Search + tag filtering |
| `extensions/kb/README.md` | Extension docs |
| `extensions/docs/review-2026-07-04/` | Code reviews per extension |

### 5.2 Model configuration

Configured in `settings.json`:

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
