---
name: web-search
description: >
  Search the web via SearXNG. Use when the user asks to "search for X", "find info about Y",
  "look up Z", "google something", or wants to discover web resources on any topic.
compatibility: >
  Requires the access-web pi extension with a running SearXNG instance (default
  http://localhost:8080, overridable via PI_SEARXNG_HOST / PI_SEARXNG_PORT).
---

# web-search

## Quick start

```text
web-search query="pinia getters"
web-search query="react 19 release" limit=10
web-search query="rust async patterns" time_range=month
```

## Parameters

| Param | Default | Notes |
|-------|---------|-------|
| `query` | required | Search query |
| `limit` | 5 | 1–100 |
| `language` | — | e.g. `en`, `de`, `all` |
| `time_range` | — | `day` \| `week` \| `month` \| `year` |
| `safesearch` | — | `0`=off, `1`=moderate, `2`=strict |
| `engines` | — | Comma-separated SearXNG engine names |
| `categories` | — | `general` \| `images` \| `news` \| `science` \| `it` \| `files` |
| `unique` | `true` | Dedupes across engines |

## Patterns

### Fresh results (docs, releases, news)
```text
web-search query="svelte 5 changelog" time_range=month
web-search query="node 22 release notes" time_range=week
```

### Technical deep-dive
```text
web-search query="vue composable pattern best practices"
web-search query="postgresql indexing strategies" limit=10
```

### Narrow by engine
```text
web-search query="raspberry pi 5 specs" engines="duckduckgo,google"
```

## Error handling

`SEARCH_UNAVAILABLE` → SearXNG not running. Check `PI_SEARXNG_HOST` / `PI_SEARXNG_PORT`.
