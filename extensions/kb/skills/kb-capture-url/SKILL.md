---
name: kb-capture-url
description: >
  Capture any URL (GitHub, documentation, YouTube) into the Knowledge Base with automatic
  routing. Use when the user says "capture this URL", "save this repo to KB", "add this
  docs page", "transcribe this video and save", or pastes any URL with intent to persist.
compatibility: >
  Requires kb, web-access, and gh extensions. gh CLI must be authenticated for GitHub URLs.
  yt-dlp required in $PATH for YouTube.
---

# kb-capture-url

One command for all URL types — auto-routes to the right tool chain.

## URL Detection

| Pattern | Route | Tools |
|---------|-------|-------|
| `github.com/<owner>/<repo>` | Repo capture | `gh-repo-view` → `kb_capture` |
| `github.com/<owner>/<repo>/issues/N` | Issue capture | `gh-issue-view` → `kb_capture` |
| `github.com/<owner>/<repo>/pull/N` | PR capture | `gh-pr-view` → `kb_capture` |
| Docs site (`*.dev/*`, `*.docs.*`, `readthedocs.io`) | Multi-page crawl | `web-fetch-docs` → `kb_capture` per page |
| Single article/doc page | Single fetch | `web-fetch` → `kb_capture` |
| `youtube.com/watch` / `youtu.be` | Transcript | `media-transcribe` → `kb_capture` |

## Workflow by Type

### GitHub Repo
```
1. gh-repo-view owner="..." repo="..."      → description, stars, language
2. gh-search-code query="repo:..." limit=5  → top code samples (optional)
3. kb_capture source="<repo info>" title="Owner/Repo" vault=personal
4. kb_ensure_page type=entity title="Repo Name" vault=personal
```

### GitHub Issue/PR
```
1. gh-issue-view owner="..." repo="..." number=N  → title, body, labels
2. kb_capture source="<issue body>" title="Issue #N: title" vault=project
3. kb_ensure_page type=source title="Issue #N Summary"
```

### Documentation Site
```
1. web-fetch-docs baseUrl="..." depth=3 label=site-name
2. docs-pages label=site-name                  → list all captured pages
3. For each page: kb_capture source="<content>" title="<title>" vault=personal
4. Batch: kb_ingest → create entity for the project, concept for key ideas
```

### Single Page
```
1. web-fetch url="..."                   → markdown
2. kb_capture source="<markdown>" title="<page title>" vault=personal
3. kb_ingest → kb_ensure_page → kb_mark_ingested
```

### YouTube Video
```
1. media-transcribe url="..."            → transcript text
2. kb_capture source="<transcript>" title="<video title>" vault=personal
3. kb_ensure_page type=source title="Video: <title>"
```

## Vault Routing

| Source | Default Vault | Why |
|--------|---------------|-----|
| GitHub repos, docs sites | `personal` | Reference material, reusable |
| Project issues/PRs | `project` | Scoped to current work |
| YouTube transcripts | `personal` | Learning material |

## Batch Pattern

For multi-page docs sites: capture ALL pages first, then ONE `kb_ingest`, then create pages, then mark all. Don't interleave.

## Fallback

If URL type can't be detected or tool chain fails: `web-fetch url="$URL"` → `kb_capture` → manual `kb_ensure_page`.
