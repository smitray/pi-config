# KB Settings Schema — Full Configuration

All settings go in `~/.pi/agent/settings.json` under the `kb` key.

```jsonc
{
  "kb": {
    // Core behavior
    "autoIngest": true,           // Auto-ingest after kb_capture
    "autoLint": true,             // Auto-lint on page creation

    // Embedding / semantic search (optional)
    "models": {
      "task": "mimo-v2.5",                          // Model for task generation
      "taskConfig": { "thinking": "low", "maxTokens": 4096 },
      "synthesis": "mimo-v2.5-pro",                 // Model for enrichment merging
      "synthesisConfig": { "thinking": "medium", "maxTokens": 8192 },
      "embedding": "nvidia/llama-nemotron-embed-vl-1b-v2:free",
      "embeddingConfig": { "dimensions": 1024 },
      "embeddingFallback": "qwen3-embedding-8b"
    },
    "embeddings": {
      "enabled": false,            // Enable semantic search
      "batchSize": 50,             // Embedding batch size
      "storePath": "meta/embeddings.json"   // Where to persist embeddings
    },

    // Search configuration
    "recall": {
      "linksThreshold": 50,        // Min backlinks to include in context
      "maxResults": 5,             // Default results per query
      "hybridWeight": 0.3          // Embedding weight (0=lexical-only, 1=semantic-only)
    },

    // Linting defaults
    "lint": {
      "staleDays": 30,             // Days before page is stale
      "warnOnOrphans": true        // Report orphan pages
    }
  }
}
```

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `KB_MODE` | auto-detect | `project` or `personal` |
| `KB_HOME` | `~/.kb/` | Personal vault root directory |

## Validation Rules

- Unknown keys are silently ignored
- `autoIngest`, `autoLint`: boolean, default `true`
- `embeddings.enabled`: enables/disables embedding pipeline
- `hybridWeight`: float 0–1, higher = more weight to embeddings
- `linksThreshold`: int, 0+ (0 = always include all links)

## Per-Vault Overrides

Settings in `settings.json` apply globally. To override per-project:
Place a `.kb/config.json` in the project root with:

```json
{
  "topic": "...",
  "mode": "project",
  "version": "1.0.0",
  "settings": {
    "lint": { "staleDays": 14 },
    "recall": { "maxResults": 10 }
  }
}
```

Per-vault `settings` merge over global values.
