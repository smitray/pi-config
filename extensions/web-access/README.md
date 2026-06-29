# access-web

Web search, fetch/crawl, **persistent docs storage**, and media download extension for pi.

Uses locally hosted services:
- **SearXNG** for search (host/port via `PI_SEARXNG_*`; defaults in env table below)
- **Crawl4AI** for web → markdown (host/port via `PI_CRAWL4AI_*`; defaults in env table below)
- **yt-dlp** for media metadata/subtitles/audio/video
- **faster-whisper** (optional) for transcript fallback

GitHub queries are handled by the existing `gh` extension; this extension does not duplicate those tools.

## Tools

| Tool | Description |
|------|-------------|
| `web-search` | Search via SearXNG with language / time / engine / category filters |
| `web-fetch` | Fetch one page as markdown, with optional BM25/LLM filter |
| `web-fetch-docs` | Recursively crawl a docs site and **persist every page to disk** for later sessions |
| `docs-list` | Inventory all locally stored docs sets |
| `docs-pages` | List pages in a docs set, or fetch the full markdown of one specific page |
| `docs-search` | Keyword search (TF-IDF) over a persisted docs set |
| `media-fetch` | yt-dlp metadata/subtitles/audio/video |
| `media-transcribe` | Subtitles first, faster-whisper fallback |

## Workflow: capture a docs site for offline reference

```text
# One-shot capture of an entire docs site
web-fetch-docs baseUrl="https://pinia.vuejs.org/introduction.html" label=pinia depth=3

# Later, in any session:
docs-list
docs-pages label=pinia
docs-search label=pinia query="getters with parameters"
docs-pages label=pinia url="https://pinia.vuejs.org/core-concepts/"
```

Persisted under `${PI_ACCESS_DOWNLOAD_DIR}/docs/<label>/`. `web-fetch-docs` with the same label will reuse the on-disk copy; pass `refresh=true` to force a re-crawl. `robots.txt` is respected; parallel fetches are bounded by `PI_ACCESS_CRAWL_CONCURRENCY` with a polite delay between batches.

## Environment

| Variable | Default |
|----------|---------|
| `PI_SEARXNG_HOST` | `localhost` |
| `PI_SEARXNG_PORT` | `8080` |
| `PI_CRAWL4AI_HOST` | `localhost` |
| `PI_CRAWL4AI_PORT` | `11234` |
| `PI_ACCESS_TIMEOUT` | `30000` |
| `PI_ACCESS_MAX_DEPTH` | `3` |
| `PI_ACCESS_CHUNK_TOKENS` | `4000` |
| `PI_ACCESS_MAX_PAGES` | `50` |
| `PI_ACCESS_CRAWL_CONCURRENCY` | `4` |
| `PI_ACCESS_CRAWL_DELAY_MS` | `200` |
| `PI_ACCESS_YTDLP_BIN` | `yt-dlp` |
| `PI_ACCESS_YTDLP_COOKIES` | — |
| `PI_ACCESS_DOWNLOAD_DIR` | `/tmp/pi-access` |
| `PI_ACCESS_MEDIA_MAX_MB` | `100` |
| `PI_ACCESS_WHISPER_BIN` | — |
| `PI_ACCESS_WHISPER_MODEL` | — |
| `PI_ACCESS_WHISPER_CUDA` | `0` |

## Configuring environment variables

There is no bundled `.env` file. The extension reads `process.env` when pi loads it.
Set variables in your shell profile, systemd unit, docker-compose, or export them before
starting pi:

```bash
# ~/.bashrc or ~/.zshrc
export PI_SEARXNG_HOST=localhost
export PI_SEARXNG_PORT=8080
export PI_CRAWL4AI_HOST=localhost
export PI_CRAWL4AI_PORT=11234
export PI_ACCESS_YTDLP_BIN=yt-dlp
export PI_ACCESS_CRAWL_CONCURRENCY=2
export PI_ACCESS_CRAWL_DELAY_MS=400
# optional whisper fallback
export PI_ACCESS_WHISPER_BIN=/usr/local/bin/whisper
export PI_ACCESS_WHISPER_MODEL=small
```

Restart pi after changing shell profile so the new env values are inherited.

Verify the backing services are reachable before using the tools:

```bash
curl "${PI_SEARXNG_HOST}:${PI_SEARXNG_PORT}/search?q=hello&format=json"
curl -X POST "${PI_CRAWL4AI_HOST}:${PI_CRAWL4AI_PORT}/md" \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com"}'
```

## Examples

### Web search

```bash
# Basic search
web-search query="pinia vue3 state management"

# Search with language and time filter
web-search query="hyprland scrolling layout" language=en time_range=week limit=5

# Search in a specific engine
web-search query="react hooks" language=en limit=10
```

### Fetch a single page

```bash
# Fetch as markdown
web-fetch url="https://pinia.vuejs.org/introduction.html"

# Fetch with BM25 filter
web-fetch url="https://example.com/long-page" q="specific topic" f=bm25

# Fetch with LLM filter
web-fetch url="https://example.com/docs" q="how to configure" f=llm
```

### Crawl and persist a docs site

```bash
# One-shot capture of an entire docs site
web-fetch-docs baseUrl="https://pinia.vuejs.org/introduction.html" label=pinia depth=3

# Capture with KB integration (writes source packets)
web-fetch-docs baseUrl="https://wiki.hypr.land" label=hyprland depth=2 kbRoot=~/.kb/

# Re-crawl an existing docs set
web-fetch-docs baseUrl="https://pinia.vuejs.org" label=pinia refresh=true

# Read from persisted docs
docs-list
docs-pages label=pinia
docs-search label=pinia query="getters with parameters"
docs-pages label=pinia url="https://pinia.vuejs.org/core-concepts/"
```

### Media download

```bash
# Get metadata
media-fetch url="https://youtube.com/watch?v=xxx" mode=metadata

# Get subtitles
media-fetch url="https://youtube.com/watch?v=xxx" mode=subtitles

# Download audio
media-fetch url="https://youtube.com/watch?v=xxx" mode=audio

# Download video
media-fetch url="https://youtube.com/watch?v=xxx" mode=video

# Transcribe (subtitles first, whisper fallback)
media-transcribe url="https://youtube.com/watch?v=xxx" lang=en
```

### KB integration workflow

```bash
# 1. Crawl docs site into KB source packets
web-fetch-docs baseUrl="https://docs.example.com" label=example-docs depth=3 kbRoot=~/.kb/

# 2. List pending sources
kb_ingest

# 3. Create wiki pages from sources
kb_ensure_page type=concept title="Example API" content="## Overview\n\n..."

# 4. Mark ingested
kb_mark_ingested sourceId=SRC-2026-06-29-001
```

## Testing

```bash
cd ~/.pi/agent/extensions
vitest run web-access
```