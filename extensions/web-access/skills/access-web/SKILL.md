---
name: access-web
description: >
  Web search, fetch/crawl, docs persistence, and media download via yt-dlp. Use when the user
  wants to search the web, fetch a URL, crawl a docs site, search persisted docs, download media,
  or transcribe audio/video. Supports SearXNG, Crawl4AI, TinyFish (opt-in), and yt-dlp.
compatibility: >
  Requires access-web extension. Local services: SearXNG, Crawl4AI, yt-dlp in $PATH. Optional:
  faster-whisper for audio transcription, TinyFish API for token-efficient search/fetch.
license: MIT
---

# access-web

Eight tools for web access: search, fetch, docs crawling, docs persistence, media, and transcription.

## Quick Start

```text
web-search query="react 19 release" time_range=month    # Search web
web-fetch url="https://example.com"                      # Fetch page as markdown
tf_search query="thing"                                  # TinyFish (if PI_TINYFISH_API_KEY set)
media-transcribe url="https://youtube.com/..."           # Transcribe video
```

## Tool Categories

| Category | Tools | Purpose |
|---|---|---|
| **Search** | `web-search`, `tf_search` | Find web content |
| **Fetch** | `web-fetch`, `tf_fetch` | Get page content as markdown |
| **Docs** | `web-fetch-docs`, `docs-list`, `docs-pages`, `docs-search` | Crawl + persist + search docs sites |
| **Media** | `media-fetch`, `media-transcribe` | Download/transcribe audio/video |

For full parameter reference for each tool, see [tool-reference.md](references/tool-reference.md).

## Environment Setup

Services must be running on configured host/port:

| Variable | Default | Service |
|---|---|---|
| `PI_SEARXNG_HOST:PORT` | `localhost:8080` | SearXNG search |
| `PI_CRAWL4AI_HOST:PORT` | `localhost:11234` | Crawl4AI fetch |
| `PI_TINYFISH_API_KEY` | — | TinyFish (opt-in) |
| `PI_ACCESS_YTDLP_BIN` | `yt-dlp` | yt-dlp binary |

## Patterns

### Pattern: research a topic

```text
1. web-search query="topic"          → ranked results
2. web-fetch url="<best result>"     → markdown content
```

### Pattern: crawl a docs site

```text
1. web-fetch-docs baseUrl="..." label=mydocs depth=3  → crawl + persist
2. docs-search label=mydocs query="specific topic"     → keyword search
3. docs-pages label=mydocs url="..."                   → read specific page
```

### Pattern: learn from a video

```text
1. media-fetch url="..." mode=metadata   → overview
2. media-transcribe url="..."            → transcript text
```

## Error Handling

| Error | Cause | Response |
|---|---|---|
| `SEARCH_UNAVAILABLE` | SearXNG not running | Check host/port |
| `FETCH_UNAVAILABLE` | Crawl4AI not running | Check host/port |
| `CRAWL_FAILED` | robots.txt disallows | Fetch specific pages instead |
| `NO_TRANSCRIPT_AVAILABLE` | No subs + no Whisper | Metadata only |
| `SIZE_LIMIT` | Video too large | Use `mode=audio` |

## What This Extension Does NOT Do

- Not for GitHub URLs — use `gh` extension tools (`gh-repo-view`, etc.)
- Not for direct GitHub API calls — all requests go through local services
- Full tool parameters: [tool-reference.md](references/tool-reference.md)
