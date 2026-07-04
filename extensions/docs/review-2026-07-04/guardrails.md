# Review: `guardrails` Extension — 2026-07-04

**Files:** 8 (index.ts, gate.ts, matcher.ts, defaults.ts, api.ts, types.ts, 3 tests, 1 skill)

## Structure

Interceptor pattern: `tool_call` hook → match rules → block/confirm. Clean separation: matcher (pure), gate (orchestrator), defaults (config), api (dynamic registration).

## What's Good

- **Token-based command matching** — handles shell wrappers (`bash -c "..."`), env vars, pipeline segments. Better than naive string includes.
- **Dynamic rule registration** — `api.ts` + `getDynamicGroups()` lets other extensions (kb) register rules at load time. All groups merged per event.
- **Scope filtering** — `scope: 'project' | 'external'` correctly resolves relative paths against cwd.
- **Exclude patterns** — `includes`/`excludes` on rules for fine-grained control.
- **Good defaults** — covers dangerous commands, interactive editors, sensitive files. Not overengineered.

## Issues

| Severity | What | Where |
|----------|------|-------|
| 🟢 | No `/guardrails toggle` — only `on`/`off`/status | `index.ts` |
| 🟢 | File content matching reads `newText`/`content` but misses `write` buffer writes | `gate.ts` line ~70 |
| 🟢 | `mkdirSync` with `recursive:false` in `kb-packets.ts` is a race — but guardrails catches `rm -rf` already | Separate concern |

## Ponytail Compliance

✅ Tight API. ✅ Commented defaults file. ✅ Types local to extension.
⚠️ `matchCommandPattern` is 80+ lines but justified (command normalization is inherently complex).
