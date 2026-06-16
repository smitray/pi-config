# Pi Extensions Workspace

**Stop and read this when user asks about extensions, test, lint, format, typecheck.**

## When User Says → Do This

| User says | Run (cwd = `~/.pi/agent/extensions/`) |
|---|---|
| "test hooks" / "test gh" / "test <ext>" | `vitest run <ext>` |
| "test all" / "all tests" | `npm test` |
| "lint" / "format" | `npm run lint` |
| "fix lint" / "lint:fix" | `npm run lint:fix` |
| "typecheck" | `npm run typecheck` |
| anything extension-related | cd here, read this file, run the command |

**Do NOT** `find`, `read README.md`, or read test files first — answer is in this file.

## Commands

| Command | What |
|---|---|
| `npm test` | All tests |
| `npm run test:watch` | TDD watch mode |
| `npm run lint` | Biome check |
| `npm run lint:fix` | Biome auto-fix |
| `npm run typecheck` | tsc --noEmit |

Per-extension: `vitest run <ext>` where `<ext>` is the directory name.

## Quick Facts

- **Pi auto-loads** any `*/index.ts` in subdirs (no settings.json entry needed)
- **Workspace name:** `pi-extensions` (npm private package)
- **Package manager:** npm (with mise-managed Node 24+)
- **Stack:** TypeScript, Biome (lint+format), Vitest (test)

## Layout

```
extensions/
├── AGENTS.md          ← you are here
├── package.json       ← scripts
├── biome.json         ← lint/format config
├── tsconfig.json      ← TypeScript config
├── <ext-dir>/         ← each extension: index.ts, test/, ...
└── README.md          ← human docs
```

**No vitest config file** — pi discovers any `*.ts`/`*.js` at extensions root as extension. Vitest defaults (`**/*.test.ts`) match our layout.

## Conventions

- **Root only: `.json` files** (biome.json, package.json, tsconfig.json). Never `.ts`/`.js` at root — pi loads them as extensions
- **All extensions share root configs** (biome.json, tsconfig.json) — no per-ext configs
- **No vitest config file** — vitest defaults work
- **Each extension is a folder** with `index.ts` (default export) + optional `test/`, `types/`, `tools/`
- **Extension must default-export a function** that takes `ExtensionAPI`
- **Run all tests before committing** — `npm test && npm run lint && npm run typecheck`

## Adding a New Extension

1. `mkdir -p my-ext/test`
2. Create `my-ext/index.ts` with default export
3. Create `my-ext/test/extension.test.ts`
4. `vitest run my-ext` to verify
5. Done — pi discovers it automatically
