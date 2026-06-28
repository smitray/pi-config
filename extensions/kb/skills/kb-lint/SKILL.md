# kb-lint

Wiki health checks and maintenance workflows.

## When to Run Lint

- **After ingest:** Verify new pages don't break links
- **Periodically:** Catch stale content and orphaned pages
- **Before commits:** Ensure wiki is healthy

## Running Lint

```javascript
const report = await kb_lint({ staleDays: 30 });
```

## Lint Checks

### 1. Orphan Pages
Pages with no inbound wikilinks from other pages.

**What it means:** The page exists but nothing links to it — it's hard to discover.

**Fix:** Add wikilinks to the page from related pages, or consider if the page is needed.

### 2. Broken Wikilinks
Wikilinks that point to non-existent pages.

**What it means:** Someone linked to a page that doesn't exist (typo or deleted page).

**Fix:** Create the missing page, fix the link, or remove the broken link.

### 3. Empty Pages
Pages with no content beyond frontmatter.

**What it means:** Placeholder page that was never filled in.

**Fix:** Add content or delete the empty page.

### 4. Stale Pages
Pages not updated in N days (default: 30).

**What it means:** Content might be outdated.

**Fix:** Review and update the content, or mark as archived.

## Lint Report Format

```
# 🔍 Lint Report

**5 issue(s)** — 2 warning(s), 3 info

## ⚠️ Broken Wikilinks (2)
- `api-design`: Broken wikilink: [[missing-page]] — target page does not exist
- `old-docs`: Broken wikilink: [[deleted-ref]] — target page does not exist

## 🔗 Orphan Pages (1)
- `temp-notes`: No inbound wikilinks — page is not referenced by other pages

## 📭 Empty Pages (1)
- `placeholder`: Page has no content beyond frontmatter

## ⏰ Stale Pages (1)
- `old-guide`: Page not updated in 45 days
```

## Maintenance Workflow

1. Run `kb_lint` weekly or after major ingestions
2. Fix broken links (highest priority — these are warnings)
3. Address orphan pages (add links or archive)
4. Clean up empty pages
5. Review stale pages for accuracy

## Manual Metadata Rebuild

If metadata seems stale (registry or backlinks out of sync):

```javascript
await kb_rebuild_meta();
```

This rebuilds `meta/registry.json` and `meta/backlinks.json` from current wiki pages.
