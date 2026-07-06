# \_shared — Internal Helpers

> Shared utilities used across multiple extensions.
> Not a pi extension — no `index.ts`, no tools, no lifecycle hooks.

## Modules

| File | Purpose | Used by |
| -- | -- | -- |
| `spawn.ts` | Background process spawn — SIGTERM→SIGKILL | gh, kb, web-access |
| `result.ts` | `ok()`/`err()` discriminated union | kb |
| `test/spawn.test.ts` | Tests for spawn module | — |

## `spawn.ts` API

- `runCommand(cmd, args, opts?)` — runs any CLI command
  asynchronously
- Returns `{ ok: true, stdout, stderr, exitCode }` or
  `{ ok: false, error, exitCode? }`
- Never throws — callers branch on `.ok`
- Accepts `input` for stdin-based commands
- Timeout via process group kill

## `result.ts` API

- `ok<T>(value: T)` — wraps a success value
- `err(message: string, detail?: unknown)` — wraps an error
- Simplifies discriminated-union across tool implementations

## Notes

- `result.ts` **duplicated** in `gh/lib/result.ts` and
  `web-access/lib/result.ts`
- `spawn.ts` has tests; `result.ts` tested through consumer
  extensions
