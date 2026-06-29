# Extension Reference

> Auto-generated reference for cross-extension reuse. Keep this updated as extensions evolve.

---

## _shared

### result.ts
- `ok(text, details?)` — success result with `{ content, details, isError: false }`
- `err(code, message, details?)` — error result with `❌` prefix

### spawn.ts
- `runCommand(bin, args, options?)` — async child process wrapper
- Returns discriminated union `{ ok, stdout, stderr, exitCode, signal }`
- SIGTERM after timeout, SIGKILL 5s later
- Default: 30s timeout, 10MB max buffer

---

## gh

### Pattern
- Tools wrap `gh` CLI via `api/gh.ts` → `_shared/spawn.ts`
- Mutation tools (clone, create) use `ctx.ui.confirm()` before execution
- `ghRepo(owner, repo, args)` — shorthand for `-R owner/repo`

### Tools (17)
- `gh-repo-view`, `gh-repo-clone`
- `gh-pr-list`, `gh-pr-view`, `gh-pr-create`
- `gh-issue-list`, `gh-issue-view`, `gh-issue-create`
- `gh-gist-list`, `gh-gist-view`, `gh-gist-create`
- `gh-search-repos`, `gh-search-code`, `gh-search-issues`, `gh-search-prs`
- `gh-workflow-list`, `gh-run-list`

### Reusable
- `api/gh.ts` — `gh()`, `ghRepo()`, `spawnErrorMessage()`
- `lib/result.ts` — duplicated, use `_shared/result.ts` instead

---

## guardrails

### Pattern
- `tool_call` hook intercepts tool execution
- Rules match on `command`, `file_name`, `file_content` contexts
- Actions: `block` (hard stop), `confirm` (user prompt)
- `/guardrails on|off` toggle

### Registration API
```ts
import { registerRules } from '../guardrails/api';
registerRules({
  group: 'my-rules',
  pattern: '*',
  rules: [{ context: 'file_name', pattern: '...', action: 'block', reason: '...' }]
});
```

### Matcher Syntax (command patterns)
- `?` = one token, `*` = zero or more tokens, `{a,b}` = alternatives
- Normalizes: strips env vars, wrappers, `bash -c` payloads
- Splits on `&&`, `||`, `;`, `|`

### Scope
- `scope: 'project'` — only files within cwd
- `scope: 'external'` — only files outside cwd

---

## hooks

### Events
- `session_start`, `session_shutdown`, `agent_start` — informational only
- `tool_call` — can block (exit 2 or `{ decision: 'block' }`)
- `tool_result` — post-execution, cannot block

### Variable Substitution
- `%file%` — file path from tool input
- `%command%` — bash command (tool_name=bash)
- `%tool%` — tool name
- `%cwd%` — current working directory

### Config
```ts
const config: HooksConfig = [{
  group: 'my-hooks',
  pattern: '*',
  hooks: [{
    event: 'tool_result',
    context: 'tool_name',
    pattern: 'kb_capture',
    command: 'echo "captured: %file%"',
  }]
}];
```

### Limitation
- Runs shell commands only, NOT Pi tools
- Cannot trigger `kb_ingest` or other extension tools directly

---

## web-access

### Tools (8)
- `web-search` — SearXNG search
- `web-fetch` — single page → markdown via Crawl4AI
- `web-fetch-docs` — recursive crawl + persist + chunk
- `docs-list`, `docs-pages`, `docs-search` — query persisted docs (TF-IDF)
- `media-fetch` — yt-dlp metadata/subtitles/audio/video
- `media-transcribe` — subtitles first, faster-whisper fallback

### Reusable Libs
- `lib/markdown.ts` — `approxTokens()`, `splitIntoChunks()`, `extractLinks()`, `extractTitle()`
- `lib/docs-store.ts` — `loadManifest()`, `savePage()`, `readPage()`, `searchDocs()` (TF-IDF)
- `lib/http.ts` — `fetchJson()` with retry on transient errors
- `lib/config.ts` — `loadConfig()` from env vars

### Crawl4AI Integration
- `web-fetch` calls `POST /md` → returns `{ url, markdown, success }`
- HTML → markdown conversion happens server-side
- KB extension should NOT do its own HTML conversion

### Docs Persistence
- Stored at `$PI_ACCESS_DOWNLOAD_DIR/docs/<label>/`
- `manifest.json` + `pages/*.md`
- TF-IDF search via `searchDocs(query, chunks, topK)`

---

## kb

### Tools (15)
- `kb_bootstrap`, `kb_ensure_page`, `kb_capture`, `kb_ingest`
- `kb_recall_context`, `kb_recall_docs`, `kb_mark_ingested`
- `kb_status`, `kb_search_tags`, `kb_rebuild_meta`
- `kb_lint`, `kb_observe`, `kb_retro`, `kb_log_event`, `kb_enrich`

### Libs
- `lib/vault.ts` — `resolveVaultContext()`, `getVaultPaths()`, `getExplicitVaultPaths()`
- `lib/capture.ts` — `captureFile()`, `captureText()` with chunking
- `lib/metadata.ts` — `rebuildMetadata()`, `extractWikilinks()`
- `lib/lint.ts` — `lintWiki()`, `formatLintReport()`
- `lib/observe.ts` — `saveObservation()`
- `lib/retro.ts` — `saveInsight()`
- `lib/events.ts` — `logEvent()`

### Hooks
- `session_start` — notify KB active
- `before_agent_start` — auto-recall if prompt has knowledge keywords
- `tool_result` — auto-rebuild metadata after wiki edits
- `tool_result` — auto-ingest after `kb_capture` (in-process)
- `tool_result` — auto-lint after ingest (logs warnings)

---

## Cross-Extension Reuse Map

| Need | Use | Don't |
|------|-----|-------|
| Tool result format | `_shared/result.ts` | Per-extension ok/err |
| Child process | `_shared/spawn.ts` | Custom spawn wrappers |
| HTML → markdown | `web-fetch` (Crawl4AI) | DIY regex conversion |
| Token estimation | `web-access/lib/markdown.ts` | Custom counters |
| Chunking | `web-access/lib/markdown.ts` | Custom splitters |
| Guardrails rules | `guardrails/api.ts` | Inline tool_call hooks |
| File search | `web-access/docs-search` (TF-IDF) | Custom search |
