---
name: web-fetch
description: >
  Fetch a single web page as clean markdown for reading, research, or KB capture. Use when
  the user shares a URL to read, says "get the content of this page", "fetch this URL",
  "scrape this page", or when pulling content from search results for analysis.
compatibility: >
  Requires the access-web pi extension with Crawl4AI running (default http://localhost:11234,
  overridable via PI_CRAWL4AI_HOST / PI_CRAWL4AI_PORT). Optional: TinyFish API key
  (PI_TINYFISH_API_KEY) for token-efficient f=clean mode.
---

# web-fetch

## Quick start

```text
web-fetch url="https://example.com"
web-fetch url="https://docs.python.org/3/library/asyncio.html" f=bm25 q="gather tasks exception"
```

## Filter strategies

| Mode | When to use | Token cost |
|------|-------------|-----------|
| `fit` (default) | General-purpose page reading | ~12k |
| `raw` | Full page, no filtering | highest |
| `bm25` | Need specific info from a large page (requires `q=`) | ~12k |
| `llm` | LLM-based relevance extraction (requires `q=`) | ~12k |
| `clean` | Minimum tokens, fastest (TinyFish API fallback Crawl4AI) | ~1.2k |

### f=clean mode

Three-tier: **TinyFish API** ~1.2k tokens (~90% reduction) → Crawl4AI fit fallback.

Works automatically — set `PI_TINYFISH_API_KEY` to enable TinyFish. Unset? Falls back to Crawl4AI fit.

```text
web-fetch url="https://en.wikipedia.org/wiki/Rickrolling" f=clean
```

## Patterns

### Read a page
```text
web-fetch url="<search result or user-provided URL>"
```

### Extract specific info from a long page
```text
web-fetch url="https://pinia.vuejs.org/core-concepts/" f=bm25 q="setup stores"
```

### Token-efficient reading (when tokens matter)
```text
web-fetch url="https://example.com" f=clean
```

## Error handling

`FETCH_UNAVAILABLE` / `FETCH_FAILED` → Crawl4AI down. Check `PI_CRAWL4AI_HOST` / `PI_CRAWL4AI_PORT`.
