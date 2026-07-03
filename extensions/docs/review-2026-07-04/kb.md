# Review: `kb` Extension — 2026-07-04

**Files:** 20+ (index.ts, 14 lib/*.ts, 10 tests, 5 skills, 8 templates)

## Structure

The largest extension at ~15 tools + 4 lifecycle hooks. Libs are well-separated: vault, capture, ingest, lint, enrich, retro, observe, events, metadata, templates, models, embeddings, recall, guardrails.

## What's Good

- **Cross-extension reuse** — imports from `_shared/result.ts` and `guardrails/api.ts`. Avoids duplication.
- **15 well-named tools** — each has a `promptSnippet` and `promptGuidelines` for the LLM to self-discover.
- **Lifecycle hooks** — auto-rebuild on wiki edits, auto-ingest after capture, auto-lint after ingest, recall on knowledge prompts.
- **Template enforcement** — 8 page types with enforced frontmatter templates.
- **Vault routing** — personal vs project KB with `resolveVaultContext()`.
- **Model config** — task/synthesis/embedding model separation via `settings.json`.
- **Good test coverage** — all major libs have tests.

## Issues

| Severity | What | Where |
|----------|------|-------|
| 🟡 | `kb/PLAN.md` says "⚠️ TODO: Delete once complete" — still present (now moved to docs/) | docs/PLAN.md |
| 🟡 | `gh/lib/result.ts` and `web-access/lib/result.ts` both duplicate `_shared/result.ts` — kb is the only one importing shared | Various |
| 🟢 | `index.ts` is 500+ lines with all 15 tools inline — hard to navigate | `index.ts` |
| 🟢 | Guardrails for KB raw/meta paths are installed at module level, not `on('session_start')` | `lib/guardrails.ts` |
| 🟢 | Auto-ingest creates a single `source`-type page — doesn't use the intelligent `synthesizeWithAI` path | `index.ts` hook section |

## Ponytail Compliance

✅ Imports shared result helpers. ✅ Uses guardrails API. ✅ `ponytail:` comments on KNOWLEDGE_KEYWORDS and vault permission mtime check.
⚠️ 500-line index.ts is a smell — but 15 tool registrations make it hard to split cleanly.
