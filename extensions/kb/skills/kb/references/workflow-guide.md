# KB Workflow Guide — Common Patterns

## Capture-then-Ingest Cycle

This is the core knowledge capture loop:

```text
1. kb_capture source="docs/arch.md" title="Architecture Doc"
2. kb_ingest                              → returns pending sources
3. Read each extracted.md                 → determine correct page type
4. kb_ensure_page type=synthesis title="Architecture Overview"
5. kb_mark_ingested sourceId="SRC-xxx"    → marks complete
```

**Key rules:**
- Batch captures first, then ONE `kb_ingest`, then create all pages, then mark all. Don't interleave.
- After capture, auto-ingest runs if `kb.autoIngest=true`. Check for pending before proceeding.

## Research & Save Pattern

Research a topic and persist findings:

```text
1. web-search(query)              → find sources
2. web-fetch(url)                 → get content
3. kb_capture(source, title)      → capture each
4. kb_ingest                      → list pending
5. kb_ensure_page(type, title)    → create wiki pages
6. kb_mark_ingested               → mark done
```

Vault routing rule of thumb:
- Library docs / tech reference → `personal` (~/.kb/)
- Project-specific research → `project` (.kb/)
- When unsure → ask_user_question

## Updating Existing Pages

When new info is discovered during discussion:

```text
1. kb_recall_context query="<topic>"  → verify exists
   If 0 results → use capture cycle above instead.
   
2. kb_observe title="<topic> update"
              content="<new insight>"
              relevance=high
   
3. kb_enrich pageTitle="<existing page>"
             observationTitle="<observation title>"
             observationContent="<new info>"
```

Enrich presents inline approval (Merge / Observe / Discard). No separate confirmation needed.

## URL Capture (via kb extension + web-access)

Capture any URL into KB with auto-routing:

| URL Pattern | Tools Used |
|---|---|
| `github.com/<owner>/<repo>` | `gh-repo-view` → `kb_capture` |
| GitHub Issue/PR | `gh-issue-view` / `gh-pr-view` → `kb_capture` |
| Docs site | `web-fetch-docs` → `kb_ingest` |
| YouTube | `media-transcribe` → `kb_capture` |
| Single page | `web-fetch` → `kb_capture` |

For GitHub URLs, prefer `gh` tools over `web-fetch` — cleaner structured output.

## Docs Site Crawling

Full documentation site capture:

```text
# First crawl
web-fetch-docs baseUrl="https://docs.example.com" label=example depth=3 chunkIndex=0

# Later session — loaded from disk
web-fetch-docs label=example chunkIndex=2

# Force re-crawl
web-fetch-docs baseUrl="..." label=example refresh=true

# With KB integration
web-fetch-docs baseUrl="..." label=example kbRoot="/path/to/project/.kb/"
```

After crawling with `kbRoot`, each page becomes a source packet. Then `kb_ingest` + `kb_ensure_page` for each.

## Enrichment Patterns

### Mid-discussion observation
During coding task, user mentions a decision or insight:
```text
kb_observe title="Chose Redis over SQLite for cache"
           content="Redis selected for concurrent access needs"
           relevance=high
           tags=["caching", "redis"]
```

### Post-decision enrichment
After making an architectural decision:
```text
kb_enrich pageTitle="Cache Strategy"
           observationTitle="Decision: Redis over SQLite"
           observationContent="Redis chosen for concurrent access pattern"
```

## Best Practices

1. **Don't spam observations.** Only capture info that genuinely adds to existing KB knowledge.
2. **Use high relevance for decisions.** "We chose JWT over sessions" = high. "JWT supports RS256" = medium.
3. **Batch at ingest.** Capture all sources first, one `kb_ingest`, create all pages, mark all ingested.
4. **Preserve observations as audit trail.** Integration doesn't delete observations.
5. **When in doubt, observe.** Better to capture and discard later than lose an insight.
6. **Run lint after bulk operations.** `kb_lint` after creating multiple pages catches broken wikilinks early.
