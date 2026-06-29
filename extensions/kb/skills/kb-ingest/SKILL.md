# kb-ingest

URL and document ingestion workflows for the KB extension.

## Single URL → KB

Fetch a URL with `web-fetch`, then capture into KB:

```
1. web-fetch(url) → markdown content
2. kb_capture(source=content, title=title, vault=personal) → source packet
3. kb_ingest() → process pending sources
```

**Vault routing:**
- Library docs (React, Pinia, Hyprland, etc.) → `vault=personal`
- Project-specific URLs → `vault=project`
- When unsure → use `ask_user_question`

## Multi-Page Docs Ingestion

For documentation sites with multiple pages:

```
1. web-fetch-docs(baseUrl, depth=3) → crawl and persist pages
2. For each page:
   - kb_capture(source=page_content, title=page_title, vault=personal)
3. kb_ingest() → batch process all pending sources
```

**Default vault for docs:** `personal` (library documentation)

## YouTube Transcript Ingestion

**Status:** Blocked — STT model not available.

Planned workflow:
```
1. media-transcribe(url) → transcript text
2. kb_capture(source=transcript, title=video_title) → source packet
3. kb_ingest() → process
```

## Vault Routing Rules

| Content Type | Target Vault | Notes |
|--------------|--------------|-------|
| Library docs (React, Pinia, Hyprland, etc.) | **Personal** (`~/.kb/`) | Default for web-access fetched docs |
| Meeting notes | **Personal** | Personal stuff |
| Artifacts (WIP, project workflow docs) | **Project** (`.kb/`) | Project-scoped only |
| Everything else | **Project** | Default for project work |
| Ambiguous | **Ask user** | Use `ask_user_question` |

**Ambiguity resolution:** When vault is unclear, use `ask_user_question` with options:
- "Save to personal KB (library docs, notes)"
- "Save to project KB (artifacts, WIP)"

## Examples

### Ingest a React documentation page

```javascript
// 1. Fetch the page
const page = await web-fetch({ url: "https://react.dev/learn/hooks-overview" });

// 2. Capture to personal KB
await kb_capture({
  source: page.markdown,
  title: "React Hooks Overview",
  vault: "personal"
});

// 3. Process pending sources
await kb_ingest();
```

### Ingest a project design doc

```javascript
// 1. Capture local file to project KB
await kb_capture({
  source: "./docs/design.md",
  title: "API Design Document",
  vault: "project"
});

// 2. Process
await kb_ingest();
```
