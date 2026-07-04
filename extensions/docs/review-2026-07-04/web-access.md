# Review: `web-access` Extension — 2026-07-04

**Files:** 13 (index.ts, 7 lib/*.ts, 4 tools/*.ts, 4 tests, 1 skill)

## Structure

8 tools across 4 tool files. Libs for config, HTTP, docs-store, markdown processing, KB packet writing, and type definitions.

## What's Good

- **Crawl4AI integration** — server-side markdown conversion, no custom HTML parser. Clean `POST /md` call.
- **Docs persistence** — full crawl → disk storage → TF-IDF retrieval pipeline. Label-based dedup.
- **KB packet writing** — `kb-packets.ts` writes source packets compatible with kb extension's capture format. Web-fetch-docs with `kbRoot` seeds KB directly.
- **Media pipeline** — yt-dlp metadata/subtitles/audio/video with size guard, subtitle cleaning, and faster-whisper fallback.
- **Robots.txt respect** — naive but functional parser in web-fetch.ts.
- **Config-driven** — all env vars centralized in `lib/config.ts` with sensible defaults.

## Issues

| Severity | What | Where |
|----------|------|-------|
| 🟡 | `lib/result.ts` duplicates `_shared/result.ts` — identical ok()/err() | `web-access/lib/result.ts` |
| 🟡 | `lib/kb-packets.ts` duplicates kb's `capture.ts` logic (source ID generation, manifest format) — comment says "kept duplicated here to avoid cross-extension import" | `lib/kb-packets.ts` |
| 🟢 | `markdown-it.ts` has a full markdown parser — but `markdown.ts` has simpler chunking. Two chunking strategies, one unused for actual token splitting | `lib/markdown-it.ts` |
| 🟢 | `chunkByHeadings` in markdown-it.ts is 120 lines with multiple edge-case branches — overengineered for the actual usage (splitIntoChunks from markdown.ts is used) | `lib/markdown-it.ts` |

## Ponytail Compliance

✅ Robots.txt is "naive" and named. ✅ TF-IDF search comment calls out the ceiling. ✅ Config defaults are sensible.
⚠️ `markdown-it.ts` has speculative complexity (chunkByHeadings, validateMarkdown) — not used by any tool directly.
⚠️ `kb-packets.ts` is a documented intentional duplicate ("~60 lines, add when KB exposes a capture library API").
