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
- [ ] Define `ModelConfig` and `KBModelsConfig` interfaces
- [ ] `loadModelsConfig()` — read from settings.json → kb.models
- [ ] Validate config on load (fail fast with clear errors)
- [ ] Support fallback models
- [ ] Cache model instances
- [ ] Test: valid config loads correctly
- [ ] Test: missing config returns defaults
- [ ] Test: invalid config throws clear error

### Task 2: Fetch-Based API Client (`lib/models.ts`)
- [ ] `complete(config, messages, options)` — OpenAI-compatible chat completion
- [ ] `embed(config, texts)` — OpenAI-compatible embedding
- [ ] Handle API key resolution ($OPENROUTER_API_KEY, $MIMO_API_KEY, etc.)
- [ ] Error handling + retry with exponential backoff
- [ ] Rate limiting queue (for free models: 20 req/min)
- [ ] Test: mock API response, verify completion
- [ ] Test: mock API response, verify embedding
- [ ] Test: error handling (429, 500, timeout)

### Task 3: Embedding Storage (`lib/embeddings.ts`)
- [ ] `storeEmbedding(pagePath, embedding)` — write to meta/embeddings.json
- [ ] `loadEmbeddings()` — read all embeddings
- [ ] `getEmbedding(pagePath)` — get single page embedding
- [ ] `removeEmbedding(pagePath)` — delete when page removed
- [ ] Track model version (re-embed on model change)
- [ ] Test: store and retrieve embedding
- [ ] Test: handle missing embeddings.json

### Task 4: Embedding Search (`lib/embeddings.ts`)
- [ ] `cosineSimilarity(a, b)` — vector math
- [ ] `cosineSearch(queryEmbedding, topK)` — search by vector
- [ ] `hybridSearch(query, topK)` — blend lexical + semantic
- [ ] `generateAndStore(text, pagePath)` — embed + store in one call
- [ ] Test: cosine similarity correctness
- [ ] Test: search returns ranked results
- [ ] Test: hybrid search blends scores

### Task 5: Integrate into `kb_enrich` (synthesis model)
- [ ] Load synthesis model config
- [ ] Use `complete()` for intelligent merging
- [ ] Fallback to simple append if model unavailable
- [ ] Test: enrichment uses synthesis model
- [ ] Test: fallback works when model fails

### Task 6: Integrate into `kb_ingest` (task model)
- [ ] Load task model config
- [ ] Use `complete()` for auto-synthesis of wiki pages
- [ ] Generate page content from extracted.md
- [ ] Test: ingest creates better pages with model
- [ ] Test: works without model (current behavior)

### Task 7: Integrate into `kb_recall_*` (embedding search)
- [ ] Generate embeddings on page create/update
- [ ] Use `hybridSearch()` in `kb_recall_context`
- [ ] Use `hybridSearch()` in `kb_recall_docs`
- [ ] Configurable hybrid weight (lexical vs semantic)
- [ ] Test: semantic search finds related pages
- [ ] Test: hybrid search improves over lexical-only

### Task 8: Settings Schema Update
- [ ] Update settings.json with kb.models config
- [ ] Add kb.embeddings config
- [ ] Document config options in PLAN.md
- [ ] Test: settings.json validates correctly

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
