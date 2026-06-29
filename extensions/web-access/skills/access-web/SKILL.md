---
name: access-web
description: >
  Web search, fetch/crawl, docs persistence, and media download skills for the local access-web
  pi extension. Use for: web search via SearXNG with freshness/language/engine filters, fetching
  a single page as markdown, recursively crawling and persisting an entire documentation site for
  offline reference (one URL in, all pages out), keyword search across stored docs, downloading
  media metadata/subtitles/audio/video via yt-dlp, and transcribing media (subtitles first,
  faster-whisper fallback).
compatibility: >
  Requires the access-web pi extension (installed at ~/.pi/agent/extensions/web-access) and local
  services: SearXNG and Crawl4AI at the host/port configured via PI_SEARXNG_* / PI_CRAWL4AI_*
  (defaults in the env table below), yt-dlp in $PATH. Optional faster-whisper for audio
  transcription fallback.
---

# access-web

This skill wraps the eight tools registered by the `access-web` extension.

## Settings (env vars)

| Variable | Default | Purpose |
| --- | --- | --- |
| `PI_SEARXNG_HOST` / `PI_SEARXNG_PORT` | `localhost:8080` | SearXNG location |
| `PI_CRAWL4AI_HOST` / `PI_CRAWL4AI_PORT` | `localhost:11234` | Crawl4AI location |
| `PI_ACCESS_TIMEOUT` | `30000` | HTTP/spawn timeout (ms) |
| `PI_ACCESS_MAX_DEPTH` | `3` | Default crawl depth for `web-fetch-docs` |
| `PI_ACCESS_MAX_PAGES` | `50` | Cap on pages crawled per docs label |
| `PI_ACCESS_CRAWL_CONCURRENCY` | `4` | Parallel fetches during a docs crawl |
| `PI_ACCESS_CRAWL_DELAY_MS` | `200` | Delay between fetch batches (politeness) |
| `PI_ACCESS_CHUNK_TOKENS` | `4000` | Target tokens per chunk |
| `PI_ACCESS_YTDLP_BIN` | `yt-dlp` | yt-dlp binary |
| `PI_ACCESS_YTDLP_COOKIES` | — | Optional cookies file |
| `PI_ACCESS_DOWNLOAD_DIR` | `/tmp/pi-access` | Storage root for media + docs |
| `PI_ACCESS_MEDIA_MAX_MB` | `100` | Max video size |
| `PI_ACCESS_WHISPER_BIN` / `PI_ACCESS_WHISPER_MODEL` | — | Optional fallback transcriber |
| `PI_ACCESS_WHISPER_CUDA` | `0` | Set to `1` for GPU faster-whisper |

## Tool quick reference

### `web-search`

Search the web via local SearXNG. Filters narrow results for fresh, topical, or scoped queries.

```text
web-search query="pinia getters" limit=5
web-search query="react 19 release" time_range=month
web-search query="rust async" engines="duckduckgo,startpage"
web-search query="llm agents" categories="it,science" language=en
```

| Param | Notes |
| --- | --- |
| `query` | Required |
| `limit` | 1–100, default 5 |
| `language` | e.g. `en`, `de`, `all` |
| `time_range` | `day` \| `week` \| `month` \| `year` \| empty for all-time |
| `safesearch` | `0` = off, `1` = moderate, `2` = strict |
| `engines` | Comma-separated engine list (SearXNG engine names) |
| `categories` | `general` \| `images` \| `news` \| `science` \| `it` \| `files` |
| `unique` | Default `true` — dedupes across engines |

Returns ranked hits with title, URL, and snippet.

### `web-fetch`

Fetch one URL as markdown via Crawl4AI. Supports content filters when a `q=` query is given.

```text
web-fetch url="https://pinia.vuejs.org/core-concepts/"
web-fetch url="https://docs.python.org/3/library/asyncio.html" f=bm25 q="gather tasks exception"
```

| Param | Notes |
| --- | --- |
| `url` | Required |
| `q` | Required when `f` is `bm25` or `llm` |
| `f` | `fit` (default) \| `raw` \| `bm25` \| `llm` |

### `web-fetch-docs` — full documentation site capture

Crawl an entire documentation site, **persist every page to disk** under `${PI_ACCESS_DOWNLOAD_DIR}/docs/<label>/`, and return chunked markdown. Persistence is the key behavior — once crawled, the same docs are available in future sessions without re-fetching.

```text
# First time: crawl + persist + chunk 0
web-fetch-docs baseUrl="https://pinia.vuejs.org/introduction.html" label=pinia depth=3 chunkIndex=0

# Later session: load from disk, no re-crawl
web-fetch-docs label=pinia chunkIndex=2

# Force fresh re-crawl
web-fetch-docs baseUrl="https://pinia.vuejs.org/introduction.html" label=pinia refresh=true

# Navigate to a specific chunk
web-fetch-docs label=pinia chunkIndex=5
```

| Param | Notes |
| --- | --- |
| `baseUrl` | Required on first crawl. Ignored when label already exists on disk (use `refresh=true` to override). |
| `label` | Required for persistence. One label = one docs site. |
| `depth` | 1–5, default 3 |
| `chunkIndex` | 0-indexed; details include `totalChunks` and `pages[]` |
| `refresh` | Force re-crawl, ignore on-disk copy |
| `kbRoot` | Optional. If set, writes each crawled page as a KB source packet to `{kbRoot}/raw/sources/SRC-.../`. Dedup by URL. Use when integrating with the `kb` extension. |

Respects `robots.txt` (returns `CRAWL_FAILED` if `Disallow: /` for `*`). Uses parallel fetches bounded by `PI_ACCESS_CRAWL_CONCURRENCY` with a polite delay between batches.

### `docs-list`

Inventory all locally stored docs sets.

```text
docs-list
```

Output per label: page count, total tokens, depth, crawl date, base URL.

### `docs-pages`

List pages in a docs set, or fetch the full markdown of one specific page.

```text
# List all pages
docs-pages label=pinia

# List first 50
docs-pages label=pinia limit=50

# Fetch one specific page
docs-pages label=pinia url="https://pinia.vuejs.org/core-concepts/"
```

If `url` is omitted, returns a page list. If `url` is given but doesn't match any persisted page, returns `PAGE_NOT_FOUND` with a sample of available URLs.

### `docs-search`

Keyword search over a persisted docs set. Returns ranked chunks with source URL and title.

```text
docs-search label=pinia query="getters with parameters"
docs-search label=pinia query="setup store" topK=10
```

Scoring is TF-IDF over chunked pages (length-normalized, English stop words filtered). Good for technical docs where exact terms matter; not a semantic search. For semantic recall, ask for top-K and let the model rerank the hits.

### `media-fetch`

Use for media metadata, subtitles, audio, or video downloads via yt-dlp.

```text
media-fetch url="https://www.youtube.com/watch?v=..." mode=metadata
media-fetch url="..." mode=subtitles
media-fetch url="..." mode=audio keep=true
media-fetch url="..." mode=video keep=true
```

Modes:

- `metadata` — title, uploader, duration, description, id.
- `subtitles` — auto-generated English subtitles, cleaned to plain text.
- `audio` — opus audio file kept in `PI_ACCESS_DOWNLOAD_DIR`.
- `video` — best video format under `PI_ACCESS_MEDIA_MAX_MB`.

`keep` defaults to `true`; set `false` only if you want explicit deletion after download.

### `media-transcribe`

Use when the user wants a transcript of a video/audio URL.

```text
media-transcribe url="https://www.youtube.com/watch?v=..."
```

- Tries yt-dlp auto-generated English subtitles first.
- If subtitles are missing and `PI_ACCESS_WHISPER_BIN` + `PI_ACCESS_WHISPER_MODEL` are set,
  falls back to faster-whisper (CPU by default; set `PI_ACCESS_WHISPER_CUDA=1` for GPU).

## Patterns

### Pattern: capture a full docs site for offline reference

```text
# 1. Crawl + persist
web-fetch-docs baseUrl="https://pinia.vuejs.org/introduction.html" label=pinia depth=3

# 2. Inspect what's available
docs-list
docs-pages label=pinia

# 3. Keyword search within the persisted docs
docs-search label=pinia query="setup stores with options API"

# 4. Read a specific page in full
docs-pages label=pinia url="https://pinia.vuejs.org/core-concepts/"
```

Future sessions skip the crawl — `docs-list` / `docs-search` / `docs-pages` hit disk.

### Pattern: search then read then brainstorm

```text
# 1. Find candidate docs sites
web-search query="hyprland keybindings documentation"

# 2. Capture the whole site once
web-fetch-docs baseUrl="<result url>" label=hyprland depth=2

# 3. Brainstorm with targeted searches
docs-search label=hyprland query="bind modifier keys workspace"
docs-pages label=hyprland url="<page from the result>"
```

### Pattern: find docs then read them

1. `web-search query="thing docs"`
2. `web-fetch url="<result url>"`
3. If the site is bigger than one page → `web-fetch-docs baseUrl="<url>" label=<topic>`

### Pattern: learn from a video

1. `media-fetch url="..." mode=metadata`
2. `media-transcribe url="..."`
3. Summarize / extract key takeaways.

### Pattern: crawl docs in chunks

1. `web-fetch-docs baseUrl="..." label="topic" chunkIndex=0`
2. Repeat with `chunkIndex=1, 2, ...` until `totalChunks` reached.
3. If output is huge, ask the user which chunk to focus on next.

## Error handling / fallbacks

- `SEARCH_UNAVAILABLE` — check SearXNG is running on the configured host/port.
- `FETCH_UNAVAILABLE` / `FETCH_FAILED` — check Crawl4AI is running at the configured `PI_CRAWL4AI_HOST` / `PI_CRAWL4AI_PORT`.
- `MISSING_QUERY` — `f=bm25` or `f=llm` requires `q=`; pass a query.
- `CRAWL_FAILED` with "robots.txt disallows" — the target site blocks crawlers. Fetch specific pages with `web-fetch` instead, or override `robots.txt` semantics in the site config.
- `DOCS_NOT_FOUND` — `docs-list` to see which labels are available.
- `PAGE_NOT_FOUND` from `docs-pages` — URL isn't in this label's crawl; `docs-pages label=X` (no url) lists what's there.
- `SIZE_LIMIT` for video — the selector could not find a format under the limit or filesize is unavailable. Switch to `mode=audio` or raise `PI_ACCESS_MEDIA_MAX_MB`.
- `NO_SUBTITLES` / `NO_TRANSCRIPT_AVAILABLE` — enable faster-whisper or use only metadata/audio.
- GitHub URLs → use the existing `gh` extension tools instead (do not download GitHub pages with `web-fetch` unless the user explicitly asks for the rendered page).