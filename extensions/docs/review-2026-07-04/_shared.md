# Review: `_shared` Extension Helper — 2026-07-04

**Files:** 3 (spawn.ts, result.ts, test/result.test.ts)

## Structure

Two shared utilities used by 3 extensions:
- `spawn.ts` — async child-process wrapper with SIGTERM → SIGKILL escalation
- `result.ts` — ok()/err() tool-result helpers

## What's Good

- **SIGTERM → SIGKILL escalation** — 5s grace period prevents orphan processes.
- **Buffer truncation** — maxBuffer guard with `[output truncated]` marker.
- **Never throws** — returns discriminated union, callers branch on `ok`.
- **Self-documenting** — `ponytail:` comment explains why this exists and when to upgrade.
- **Zero dependencies** — uses only `node:child_process`.

## Issues

| Severity | What | Where |
|----------|------|-------|
| 🟡 | `result.ts` is duplicated in `gh/lib/result.ts` and `web-access/lib/result.ts` — gh and web-access chose not to import from `_shared` | kb uses it, others don't |
| 🟢 | No `maxBuffer` overflow for stderr path — both stdout and stderr share same buffer limit but truncation is checked independently | `spawn.ts` |
| 🟢 | Test coverage only for result.ts — spawn.ts has no dedicated tests | `test/` |

## Ponytail Compliance

✅ Comment says "ponytail: this exists because three extensions all needed the same wrapper." ✅ Named the ceiling (timeout/kill escalation). ✅ Named the upgrade path ("add as OPTION, not fork").
