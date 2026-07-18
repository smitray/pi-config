# Review: Extension Workspace Findings - 2026-07-12

This note captures the concrete issues found in the current `extensions/` workspace during review.

## Scope

- `kb`
- `web-access`
- `better-footer`

## Findings

| Severity | What | Where |
|----------|------|-------|
| High | Vault detection can misclassify unrelated paths as `project` because it walks all the way up the directory tree and treats any ancestor `.git` or `package.json` as a project marker. This caused `resolveVaultContext()` and `getExplicitVaultPaths()` to return `project` in places that should have stayed `personal`. | [`kb/lib/vault.ts`](../../kb/lib/vault.ts) |
| High | `better-footer` imports `ThinkingLevelSelectEvent` from `@earendil-works/pi-coding-agent`, but the installed package does not export that symbol, so `npm run typecheck` fails. | [`better-footer/index.ts`](../../better-footer/index.ts) |
| Medium | `media-transcribe` accepts a `lang` parameter but does not use it. Subtitle fetching is hardcoded to English. | [`web-access/tools/media-cli.ts`](../../web-access/tools/media-cli.ts) |
| Medium | The video size guard is only checked in a pre-flight selector, but the actual download uses `-f best`, so a too-large file can still be downloaded before being rejected. | [`web-access/tools/media-cli.ts`](../../web-access/tools/media-cli.ts) |

## Live Network Tests

Two failures observed during `npm test` depend on external services and are therefore flaky by design:

- `media-fetch` metadata for `https://www.youtube.com/watch?v=jNQXAC9IVRw`
- `web-fetch-docs` crawl against `https://wiki.hypr.land/Configuring/Basics/Binds/`

These exercise the real YouTube / `yt-dlp` path and the Crawl4AI-backed docs crawler, respectively. Failures here usually reflect upstream availability, rate limits, or content changes rather than a deterministic local bug.

## Commands Run

- `npm test`
- `npm run typecheck`

## Notes

- There were pre-existing workspace edits in `extensions/kb/lib/templates.ts` and `settings.json`; I left them untouched.
- The failing live-network tests are useful smoke checks, but they should not be treated as stable regression tests without a local mock or fixture layer.
