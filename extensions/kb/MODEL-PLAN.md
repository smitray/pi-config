# KB Model Configuration Plan

## Overview

Add model configuration to `settings.json` so KB can use different models for different tasks (ingest, synthesis, embeddings). Supports Xiaomi, MiniMax, and OpenRouter providers.

---

## 1. Settings Schema

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
    }
  }
}
```

---

## 2. Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `lib/models.ts` | Model config loader, fetch-based API client |
| `lib/embeddings.ts` | Embedding generation, storage, search |
| `test/models.test.ts` | Model config tests |
| `test/embeddings.test.ts` | Embedding tests |

### Modified Files

| File | Change |
|------|--------|
| `index.ts` | Pass model config to tools that need it |
| `lib/enrich.ts` | Use synthesis model for merging |
| `lib/ingest.ts` | Use task model for auto-synthesis |
| `lib/observe.ts` | Optional: use task model for relevance scoring |

---

## 3. Implementation Tasks

### Task 1: Model Config Loader (`lib/models.ts`)
- [x] Define `ModelConfig` and `KBModelsConfig` interfaces
- [x] `loadModelsConfig()` — read from settings.json → kb.models
- [x] Validate config on load (fail fast with clear errors)
- [x] Support fallback models
- [x] Cache model instances
- [x] Test: valid config loads correctly
- [x] Test: missing config returns defaults
- [x] Test: invalid config throws clear error

### Task 2: Fetch-Based API Client (`lib/models.ts`)
- [x] `complete(config, messages, options)` — OpenAI-compatible chat completion
- [x] `embed(config, texts)` — OpenAI-compatible embedding
- [x] Handle API key resolution ($OPENROUTER_API_KEY, $MIMO_API_KEY, etc.)
- [x] Error handling + retry with exponential backoff
- [x] Rate limiting queue (for free models: 20 req/min)
- [x] Test: mock API response, verify completion
- [x] Test: mock API response, verify embedding
- [x] Test: error handling (429, 500, timeout)

### Task 3: Embedding Storage (`lib/embeddings.ts`)
- [x] `storeEmbedding(pagePath, embedding)` — write to meta/embeddings.json
- [x] `loadEmbeddings()` — read all embeddings
- [x] `getEmbedding(pagePath)` — get single page embedding
- [x] `removeEmbedding(pagePath)` — delete when page removed
- [x] Track model version (re-embed on model change)
- [x] Test: store and retrieve embedding
- [x] Test: handle missing embeddings.json

### Task 4: Embedding Search (`lib/embeddings.ts`)
- [x] `cosineSimilarity(a, b)` — vector math
- [x] `cosineSearch(queryEmbedding, topK)` — search by vector
- [x] `hybridSearch(query, topK)` — blend lexical + semantic
- [x] `generateAndStore(text, pagePath)` — embed + store in one call
- [x] Test: cosine similarity correctness
- [x] Test: search returns ranked results
- [x] Test: hybrid search blends scores

### Task 5: Integrate into `kb_enrich` (synthesis model)
- [x] Load synthesis model config
- [x] Use `complete()` for intelligent merging
- [x] Fallback to simple append if model unavailable
- [x] Test: enrichment uses synthesis model
- [x] Test: fallback works when model fails

### Task 6: Integrate into `kb_ingest` (task model)
- [x] Load task model config
- [x] Use `complete()` for auto-synthesis of wiki pages
- [x] Generate page content from extracted.md
- [x] Test: ingest creates better pages with model
- [x] Test: works without model (current behavior)

### Task 7: Integrate into `kb_recall_*` (embedding search)
- [x] Generate embeddings on page create/update
- [x] Use `hybridSearch()` in `kb_recall_context`
- [x] Use `hybridSearch()` in `kb_recall_docs`
- [x] Configurable hybrid weight (lexical vs semantic)
- [x] Test: semantic search finds related pages
- [x] Test: hybrid search improves over lexical-only

### Task 8: Settings Schema Update
- [x] Update settings.json with kb.models config
- [x] Add kb.embeddings config
- [x] Document config options in PLAN.md
- [x] Test: settings.json validates correctly

---

## 4. Implementation Order

1. **Task 1** — Model config loader
2. **Task 2** — Fetch-based API client
3. **Task 3** — Embedding storage
4. **Task 4** — Embedding search
5. **Task 8** — Settings schema update
6. **Task 5** — kb_enrich integration
7. **Task 6** — kb_ingest integration
8. **Task 7** — kb_recall integration

---

## 5. Risks

| Risk | Mitigation |
|------|------------|
| API changes | Use OpenAI-compatible format (stable) |
| Rate limits | Queue + exponential backoff |
| Cost overrun | Set maxTokens, log usage |
| Embedding drift | Store model version, re-embed on model change |
