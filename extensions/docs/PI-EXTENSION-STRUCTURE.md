# Pi Extension Workspace Structure

This is the recommended layout for a Pi coding-agent home directory and its extension workspace.
It follows the Pi loader rules and avoids the common pitfall of mixing runtime extensions with
workspace tooling and generated output.

## Recommended Root Layout

```text
~/.pi/agent/
├── settings.json
├── models.json
├── keybindings.json
├── trust.json
├── auth.json
├── extensions/
│   ├── AGENTS.md
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── biome.json
│   ├── docs/
│   ├── _shared/
│   ├── better-footer/
│   ├── guardrails/
│   ├── hooks/
│   ├── kb/
│   ├── markdown-it/
│   ├── markitdown/
│   └── web-access/
├── skills/
├── prompts/
├── themes/
├── packages/
├── git/
├── npm/
└── coverage/ or .coverage/  (generated, not source)
```

## What Goes Where

### `~/.pi/agent/`

This is the Pi home directory.

- `settings.json` for global agent settings.
- `models.json` for provider/model config.
- `keybindings.json` for UI keybindings.
- `trust.json` for saved trust decisions.
- `auth.json` for auth state.
- `extensions/` for all extension source.
- `skills/`, `prompts/`, and `themes/` for Pi resource types.

### `~/.pi/agent/extensions/`

This is the extension development workspace.

Keep only:

- extension packages
- shared internal helpers
- extension tests
- workspace docs
- package-level tooling config

Avoid putting unrelated runtime files at this level.

Pi discovers extensions from:

- `~/.pi/agent/extensions/*.ts`
- `~/.pi/agent/extensions/*/index.ts`
- `~/.pi/agent/extensions/*/index.js`
- directories with a `package.json` that declares a `pi` manifest

That means a stray root-level `.ts` or `.js` file can be loaded as an extension.
Keep root-level code intentional.

### Each Extension Folder

Recommended shape:

```text
extensions/kb/
├── index.ts
├── lib/
├── skills/
├── templates/
└── test/
```

```text
extensions/web-access/
├── index.ts
├── lib/
├── tools/
└── test/
```

```text
extensions/hooks/
├── index.ts
├── commands/
├── engine/
├── types/
└── test/
```

Rules:

- `index.ts` should default-export the extension factory.
- Put runtime helpers under `lib/`, `tools/`, `engine/`, or similar feature-specific folders.
- Put tests under `test/`.
- Keep extension-local assets under the extension folder, not at the workspace root.

### Shared Helpers

Use `extensions/_shared/` for reusable internal helpers that are not Pi extensions themselves.

- Good for small utilities like result wrappers or spawn helpers.
- Avoid putting app-specific runtime logic here unless multiple extensions truly share it.

### Docs

Use `extensions/docs/` for:

- code review notes
- workspace-level findings
- migration notes
- setup documentation

Do not put runtime extension entry points in `docs/`.

### Generated Output

Generated output should not be treated as source.

Examples:

- `coverage/`
- `.vitest/`
- build artifacts
- temporary crawl/download caches

Best practice:

- keep generated output outside `extensions/` if possible
- otherwise add it to Biome/Vitest ignore rules
- never commit generated coverage reports unless there is a specific reason

## Testing Layout

Recommended:

```text
extensions/<ext>/test/
```

Use Vitest defaults when possible.

- Prefer `vitest run` with the workspace layout.
- Avoid a custom Vitest config unless the workspace layout truly requires it.
- If you do need one, keep it minimal and make sure it does not create files that Biome scans as source.

## Tooling Layout

Recommended workspace config files:

```text
extensions/package.json
extensions/package-lock.json
extensions/tsconfig.json
extensions/biome.json
```

These are workspace-level files, not Pi runtime files.

## Practical Best Practice

If you want the cleanest setup:

1. Keep Pi runtime config at `~/.pi/agent/`.
2. Keep extension source under `~/.pi/agent/extensions/<name>/`.
3. Keep workspace docs under `~/.pi/agent/extensions/docs/`.
4. Keep generated output out of the scanned source tree or explicitly ignored.
5. Avoid extra root-level TypeScript files unless they are intended extensions.

## What This Means For Your Current Tree

- `extensions/better-footer/`, `extensions/guardrails/`, `extensions/hooks/`, `extensions/kb/`, `extensions/web-access/`, `extensions/markdown-it/`, and `extensions/markitdown/` are in the right place.
- `extensions/AGENTS.md`, `extensions/package.json`, `extensions/tsconfig.json`, and `extensions/biome.json` are good workspace-level files.
- `coverage/` should be treated as generated output and excluded from linting.
- A `vitest.config.mts` file is usually unnecessary here; the workspace can rely on Vitest defaults unless you have a specific reason to override them.

## Summary

The best practice is not “move everything out of `extensions/`”.
The best practice is:

- keep Pi-discoverable runtime files intentional
- keep workspace tooling separate from runtime code
- keep generated artifacts out of source scans
- let Pi’s extension loader discover only the files meant to be loaded
