# Review: `gh` Extension — 2026-07-04

**Files:** 13 (index.ts, api/gh.ts, lib/result.ts, 6 tools, 3 tests, 1 skill)

## Structure

Clean 1:1 mapping between `gh` CLI commands and pi tools. 6 tool files register 17 tools total. All share a thin wrapper `api/gh.ts` over `_shared/spawn.ts`.

## What's Good

- **Consistent error handling** — every tool checks `!r.ok || r.exitCode !== 0` and uses `spawnErrorMessage()` for readable errors.
- **Confirmation on mutations** — clone, PR create, issue create, gist create all call `ctx.ui.confirm()` before executing.
- **Shared spawn** — uses `_shared/spawn.ts` instead of rolling its own child_process wrapper.
- **Skill bundled** — SKILL.md travels with the extension via `resources_discover`.
- **Good test coverage** — api/gh.ts and lib/result.ts both tested.

## Issues

| Severity | What | Where |
|----------|------|-------|
| 🟡 | `lib/result.ts` duplicates `_shared/result.ts` — identical ok()/err() but inlined | `gh/lib/result.ts` |
| 🟢 | No `gh auth status` check on load — fail silently with auth errors at first call | Every tool |
| 🟢 | `gh-repo-clone` dir parameter uses `dir?` but no validation on path safety | `tools/repo.ts` |
| 🟢 | Search tools don't support output format (JSON vs table) | `tools/search.ts` |

## Ponytail Compliance

✅ Uses `_shared/spawn.ts`. ✅ No speculative abstractions. ✅ One-line error helper.
⚠️ `lib/result.ts` is a known duplicate — cross-extension import wasn't done.
