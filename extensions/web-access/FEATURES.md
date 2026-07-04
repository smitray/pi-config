# web-access — Features

> Web search, fetch/crawl, documentation persistence, and media download.
> Powered by SearXNG (search), Crawl4AI (fetch), and yt-dlp (media).

## Tools (8)

### Web Search

| Tool | Description |
|------|-------------|
| `web-search` | SearXNG web search — supports freshness, language, and engine filters |

### Web Fetch

| Tool | Description |
|------|-------------|
| `web-fetch` | Fetch a single URL as markdown — BM25/LLM filtering strategies |
| `web-fetch-docs` | Recursively crawl a documentation site, persist pages to disk, return chunked markdown for retrieval |

### Documentation Store

| Tool | Description |
| ------ | ------------- |
| `docs-list` | List all locally stored documentation sets (page counts, sizes) |
| `docs-pages` | List pages in a docs set, or fetch the full markdown of a specific page by URL |
| `docs-search` | TF-IDF keyword search across a persisted docs set |

### Media

| Tool | Description |
|------|-------------|
| `media-fetch` | yt-dlp integration — metadata, subtitles, audio, or video download |
| `media-transcribe` | Transcribe media — subtitles first, faster-whisper fallback |

## Internal Modules

| File | Purpose |
| ------ | --------- |
| `http.ts` | HTTP client helpers |
| `markdown-it.ts` | HTML→Markdown conversion |
| `markdown.ts` | Markdown parsing utilities |
| `docs-store.ts` | TF-IDF indexed documentation store — persisted to disk, searchable by keyword |
| `kb-packets.ts` | KB source packet writer — **duplicates** `kb/lib/capture.ts` logic (source ID, manifest) |
| `result.ts` | `ok()`/`err()` helpers — **duplicated** from `_shared/result.ts` |
| `types.ts` | Shared type definitions |
| `config.ts` | SearXNG endpoint, Crawl4AI endpoint, download directory |

## Skills

| Skill | Location |
|-------|----------|
| `access-web` | `skills/access-web/SKILL.md` |

## Lifecycle

| Hook | Action |
|------|--------|
| `session_shutdown` | Cleanup if needed |

## Cross-Extension

- Uses `_shared/spawn.ts` for yt-dlp and background fetch
- `lib/result.ts` duplicates `_shared/result.ts` instead of importing it
- `lib/kb-packets.ts` duplicates `kb/lib/capture.ts` — ~60 lines, noted as intentional

## Configuration

Endpoints configured in `config.ts`:

| Setting | Default |
|--------- | --------- |
| SearXNG endpoint | `http://localhost:8080` |
| Crawl4AI endpoint | `http://localhost:11234` |
| Download directory | `PI_ACCESS_DOWNLOAD_DIR` env var |

## Notes

- Docs store uses TF-IDF (not embeddings) — marked as ponytail choice, upgrade path when needed
- `markdown-it.ts` has `chunkByHeadings()` at 120+ lines, unused for actual splitting
- Media downloads persist to `PI_ACCESS_DOWNLOAD_DIR`
