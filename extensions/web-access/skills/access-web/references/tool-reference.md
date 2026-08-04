# Tool Reference — All Parameters

## web-search

Search via SearXNG. Returns ranked hits with title, URL, snippet.

| Param | Default | Notes |
|---|---|---|
| `query` | required | Search query |
| `limit` | 5 | 1–100 |
| `language` | — | e.g., `en`, `de`, `all` |
| `time_range` | — | `day` \| `week` \| `month` \| `year` \| empty = all-time |
| `safesearch` | — | `0`=off, `1`=moderate, `2`=strict |
| `engines` | — | Comma-separated SearXNG engine names |
| `categories` | — | `general` \| `images` \| `news` \| `science` \| `it` \| `files` |
| `unique` | `true` | Dedupes across engines |

```text
web-search query="react 19" time_range=month limit=10
```

## tf_search (opt-in)

TinyFish search. Requires `PI_TINYFISH_API_KEY`. Structured results, reranked for accuracy (~90% fewer tokens than Crawl4AI).

| Param | Default | Notes |
|---|---|---|
| `query` | required | Search query |
| `limit` | 5 | 1–100 |
| `purpose` | — | Optional intent signal for better ranking |

On SimpleQA benchmark: first result has correct answer 49.2% of the time.

## web-fetch

Fetch one URL as markdown via Crawl4AI. Supports content filters.

| Param | Default | Notes |
|---|---|---|
| `url` | required | Page URL |
| `q` | — | Required when `f=bm25` or `f=llm` |
| `f` | `fit` | `fit` (default) \| `raw` \| `bm25` \| `llm` \| `clean` |

**Filter strategies:**

| Mode | Description | Token cost |
|---|---|---|
| `fit` | General-purpose page reading | ~12k |
| `raw` | Full page, no filtering | highest |
| `bm25` | BM25 relevance extraction (needs `q=`) | ~12k |
| `llm` | LLM-based extraction (needs `q=`) | ~12k |
| `clean` | TinyFish API → Crawl4AI fallback | ~1.2k |

`f=clean` three-tier: TinyFish (~1.2k tokens) → Crawl4AI fit fallback. Set `PI_TINYFISH_API_KEY` to enable.

## tf_fetch (opt-in)

TinyFetch fetch. Requires `PI_TINYFISH_API_KEY`. Renders JS-heavy pages, strips ads/navigation, returns clean markdown.

| Param | Notes |
|---|---|
| `url` | Required |

Returns `source: tinyfish` in details. Free tier available.

## web-fetch-docs

Full documentation site capture. Crawls recursively, persists to disk, returns chunked markdown.

| Param | Default | Notes |
|---|---|---|
| `baseUrl` | required (first crawl) | Ignored when label exists on disk; use `refresh=true` to override |
| `label` | required | Unique identifier per docs site |
| `depth` | 3 | 1–5, max recursion depth |
| `chunkIndex` | 0 | 0-indexed chunk number |
| `refresh` | `false` | Force re-crawl |
| `kbRoot` | — | If set, writes each page as KB source packet to `{kbRoot}/raw/sources/SRC-.../` |

**First crawl:** provide `baseUrl`, `label`, optional `kbRoot`.

**Later sessions:** only `label` + desired `chunkIndex`. No re-crawl from disk cache.

Respects robots.txt (`CRAWL_FAILED` if disallowed). Parallel fetches bounded by `PI_ACCESS_CRAWL_CONCURRENCY`.

Environment settings:
| Variable | Default | Purpose |
|---|---|---|
| `PI_ACCESS_MAX_DEPTH` | 3 | Max crawl depth |
| `PI_ACCESS_MAX_PAGES` | 200 | Pages per crawl |
| `PI_ACCESS_CRAWL_CONCURRENCY` | 4 | Parallel fetches |
| `PI_ACCESS_CRAWL_DELAY_MS` | 200 | Delay between batches |
| `PI_ACCESS_CHUNK_TOKENS` | 4000 | Target tokens per chunk |

## docs-list

Inventory persisted docs sets.

```text
docs-list
```

Output per label: page count, total tokens, depth, crawl date, base URL.

## docs-pages

List pages in a docs set, or fetch full markdown of one specific page.

| Param | Notes |
|---|---|
| `label` | Required |
| `limit` | Default 200, max 1000 |
| `url` | If given, fetch that page instead of listing |

Returns `PAGE_NOT_FOUND` if URL doesn't match any persisted page (provides sample URLs).

## docs-search

Keyword search over persisted docs set. TF-IDF scoring, not semantic.

| Param | Default | Notes |
|---|---|---|
| `label` | required | Docs set label |
| `query` | required | Search query |
| `topK` | 5 | Number of results |

Good for technical docs where exact terms matter. Not for semantic queries.

## media-fetch

Media download via yt-dlp.

| Param | Default | Notes |
|---|---|---|
| `url` | required | YouTube, Vimeo, any yt-dlp-supported site |
| `mode` | `metadata` | `metadata` \| `subtitles` \| `audio` \| `video` |

Modes:
- `metadata`: title, uploader, duration, description, id
- `subtitles`: auto-generated English subtitles, cleaned to plain text
- `audio`: opus audio file in `PI_ACCESS_DOWNLOAD_DIR`
- `video`: best format under `PI_ACCESS_MEDIA_MAX_MB`

Settings:
| Variable | Default | Purpose |
|---|---|---|
| `PI_ACCESS_YTDLP_BIN` | `yt-dlp` | yt-dlp binary path |
| `PI_ACCESS_YTDLP_COOKIES` | — | Optional cookies file |
| `PI_ACCESS_DOWNLOAD_DIR` | `/tmp/pi-access` | Media storage root |
| `PI_ACCESS_MEDIA_MAX_MB` | 100 | Max video size |

## media-transcribe

Video/audio transcription. Tries auto-generated English subtitles first. Falls back to faster-whisper if configured.

| Param | Default | Notes |
|---|---|---|
| `url` | required | Media URL |
| `lang` | `en` | Subtitle language |

Whisper fallback settings:
| Variable | Default | Purpose |
|---|---|---|
| `PI_ACCESS_WHISPER_BIN` | — | Whisper binary |
| `PI_ACCESS_WHISPER_MODEL` | — | Model name |
| `PI_ACCESS_WHISPER_CUDA` | `0` | GPU acceleration |
