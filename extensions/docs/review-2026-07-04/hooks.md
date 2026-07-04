# Review: `hooks` Extension — 2026-07-04

**Files:** 7 (index.ts, engine/events.ts, engine/hook-execution.ts, commands/register.ts, types/schema.ts, 2 tests, 1 skill)

## Structure

Event-driven shell hooks: subscribe to pi lifecycle events → run shell commands with variable substitution. `events.ts` registers handlers, `hook-execution.ts` runs the shell commands.

## What's Good

- **Exit code 2 = block convention** — matches Claude Code's hook convention. Simple and predictable.
- **Variable substitution** — `%file%`, `%command%`, `%tool%`, `%cwd%` cover the common use cases.
- **JSON output shape** — hooks can return structured JSON to influence pi behavior.
- **Graceful error handling** — hooks never block the main flow on failure; errors are just notifications.
- **Empty default config** — ponytail: no speculative hooks, user adds what they need.

## Issues

| Severity | What | Where |
|----------|------|-------|
| 🟢 | Only shell commands, not Pi tools — can't chain kb/gh tools as hooks | Schema limitation |
| 🟢 | Config is hardcoded in `index.ts` — no file-based loading | `index.ts` line ~34 |
| 🟢 | No timeout override per-rule in the schema — rules share the timeout | `hook-execution.ts` |
| 🟢 | No test for the blocking path (exit code 2) | `test/hook-execution.test.ts` |

## Ponytail Compliance

✅ Empty default config. ✅ Four variable substitutions, not ten. ✅ `runCommand` via `_shared/spawn.ts`.
⚠️ Comment explicitly calls out "ponytail: empty default config."
