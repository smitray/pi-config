---
name: access-web
description: >
  Web search, fetch/crawl, docs persistence, and media download skills for the local access-web
  pi extension. Defaults: SearXNG for search, Crawl4AI for fetch. Opt-in: tf_search/tf_fetch
  via TinyFish (free tier, requires PI_TINYFISH_API_KEY). Use for: web search with language/time
  filters, fetching a page as markdown, recursively crawling and persisting a docs site, keyword
  search across stored docs, downloading media metadata/subtitles/audio/video via yt-dlp,
  and transcribing media (subtitles first, faster-whisper fallback).
compatibility: >
  Requires the access-web pi extension (installed at ~/.pi/agent/extensions/web-access) and local
  services: SearXNG and Crawl4AI at the host/port configured via PI_SEARXNG_* / PI_CRAWL4AI_*
  (defaults in the env table below), yt-dlp in $PATH. Optional faster-whisper for audio
  transcription fallback. TinyFish (search + fetch) is opt-in: set PI_TINYFISH_API_KEY to enable.
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
| `PI_ACCESS_MAX_PAGES` | `200` | Cap on pages crawled per docs label |
| `PI_ACCESS_CRAWL_CONCURRENCY` | `4` | Parallel fetches during a docs crawl |
| `PI_ACCESS_CRAWL_DELAY_MS` | `200` | Delay between fetch batches (politeness) |
| `PI_ACCESS_CHUNK_TOKENS` | `4000` | Target tokens per chunk |
| `PI_ACCESS_YTDLP_BIN` | `yt-dlp` | yt-dlp binary |
| `PI_ACCESS_YTDLP_COOKIES` | — | Optional cookies file |
| `PI_ACCESS_DOWNLOAD_DIR` | `/tmp/pi-access` | Storage root for media + docs |
| `PI_ACCESS_MEDIA_MAX_MB` | `100` | Max video size |
| `PI_ACCESS_WHISPER_BIN` / `PI_ACCESS_WHISPER_MODEL` | — | Optional fallback transcriber |
| `PI_ACCESS_WHISPER_CUDA` | `0` | Set to `1` for GPU faster-whisper |
| `PI_TINYFISH_API_KEY` | — | TinyFish API key (enables `tf_search` and `tf_fetch`) |
| `PI_TINYFISH_API_BASE` | `https://api.fetch.tinyfish.ai` | TinyFish Fetch endpoint |
| `PI_TINYFISH_SEARCH_BASE` | `https://api.search.tinyfish.ai` | TinyFish Search endpoint |

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
| `f` | `fit` (default) \| `raw` \| `bm25` \| `llm` \| `clean` (uses TinyFish fetch if key is set, falls back to Crawl4AI fit) |

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

### `tf_search` — TinyFish search (opt-in)

Search the web via TinyFish. Free tier, structured JSON results, reranked for accuracy rather than SEO. Results are ~90% fewer tokens than Crawl4AI fetch. Use when you need fast, accurate answers or when SearXNG is unavailable.

```text
tf_search query="nvidia free ai models" limit=5
```

| Param | Notes |
| --- | --- |
| `query` | Required |
| `limit` | 1–100, default 5 |
| `purpose` | Optional intent signal — improves ranking for accuracy over SEO. Keep to a short phrase or sentence. |

Requires `PI_TINYFISH_API_KEY` to be set. Returns ranked hits with title, URL, and snippet.

**Reranking behavior**: TinyFish scores results for answer accuracy (not SEO popularity). On the SimpleQA benchmark, the first result contains the correct answer 49.2% of the time — better than alternatives. The `purpose` parameter gives TinyFish additional signal to further refine ranking.

### `tf_fetch` — TinyFish fetch (opt-in)

Fetch a URL via TinyFish. Renders JavaScript-heavy pages, strips ads/navigation, returns clean markdown. Free tier. Use when you need cleaner output with fewer tokens than Crawl4AI.

```text
tf_fetch url="https://example.com"
```

| Param | Notes |
| --- | --- |
| `url` | Required |

Requires `PI_TINYFISH_API_KEY` to be set. Returns clean markdown with `source: tinyfish` in details.

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
# 1. Find candidate docs sites (SearXNG or TinyFish)
web-search query="hyprland keybindings documentation"
# or: tf_search query="hyprland keybindings documentation"

# 2. Capture the whole site once
web-fetch-docs baseUrl="<result url>" label=hyprland depth=2

# 3. Brainstorm with targeted searches
docs-search label=hyprland query="bind modifier keys workspace"
docs-pages label=hyprland url="<page from the result>"
```

### Pattern: find docs then read them

1. `web-search query="thing docs"` (SearXNG) or `tf_search query="thing docs"` (TinyFish)
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
- `TINYFISH_SEARCH_UNAVAILABLE` — check `PI_TINYFISH_API_KEY` is set and the TinyFish API is reachable.
- `FETCH_UNAVAILABLE` / `FETCH_FAILED` — check Crawl4AI is running at the configured `PI_CRAWL4AI_HOST` / `PI_CRAWL4AI_PORT`.
- `TF_FETCH_UNAVAILABLE` — check `PI_TINYFISH_API_KEY` is set and the TinyFish API is reachable. Falls back to Crawl4AI if `tf_fetch` fails.
- `MISSING_QUERY` — `f=bm25` or `f=llm` requires `q=`; pass a query.
- `CRAWL_FAILED` with "robots.txt disallows" — the target site blocks crawlers. Fetch specific pages with `web-fetch` instead, or override `robots.txt` semantics in the site config.
- `DOCS_NOT_FOUND` — `docs-list` to see which labels are available.
- `PAGE_NOT_FOUND` from `docs-pages` — URL isn't in this label's crawl; `docs-pages label=X` (no url) lists what's there.
- `SIZE_LIMIT` for video — the selector could not find a format under the limit or filesize is unavailable. Switch to `mode=audio` or raise `PI_ACCESS_MEDIA_MAX_MB`.
- `NO_SUBTITLES` / `NO_TRANSCRIPT_AVAILABLE` — enable faster-whisper or use only metadata/audio.
- GitHub URLs → use the existing `gh` extension tools instead (do not download GitHub pages with `web-fetch` unless the user explicitly asks for the rendered page).
