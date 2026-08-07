---
name: ast-grep
description: >
  Structural code search, refactoring, and repository lint-rule setup with ast-grep. Use when
  searching by syntax shape, writing or testing ast-grep rules, configuring sgconfig.yml,
  enforcing coding standards, selecting rule severity, or adding ast-grep to project checks.
license: MIT
metadata:
  version: "2.0.2"
  author: "Edmund Miller"
---

# ast-grep

Syntax-aware search, rewriting, and structural coding standards. Prefer over `rg`/`grep` for structural code search.

## When to use

| Need | Tool |
|---|---|
| Find one syntax shape | `ast-grep run --pattern ...` |
| Preview or apply rule file | `ast-grep scan --rule rule.yml` |
| Enforce repo standards | `sgconfig.yml` + rules directory |
| Search literal text / comments | grep, not ast-grep |
| Follow definitions / types | language server, not ast-grep |

For full command reference, see [command-reference.md](references/command-reference.md).

## Quick start: extensions

Run from `~/.pi/agent` and scope searches to custom extension code:

```bash
ast-grep run -l ts -p 'pi.registerTool($$$)' extensions --globs '!node_modules/**'
ast-grep run -l ts -p 'export default function($$$)' extensions --globs '!node_modules/**'
```

ast-grep parses files on demand. It does **not** create a tags file or persistent AST index. `sgconfig.yml`, `ast-grep/rules/`, and rule tests are only needed for repeatable lint rules; searches need none of them.

## Search Pattern Syntax

Metavariables capture AST nodes. Always quote patterns with single quotes so shell does not expand `$`.

| Syntax | Meaning |
|---|---|
| `$VAR` | One named AST node |
| `$$VAR` | One named or anonymous node |
| `$$$ARGS` | Zero or more nodes |
| `$_` / `$$$` | Non-capturing match |

Examples:
```bash
ast-grep run -p 'console.log($$$ARGS)' src
ast-grep run -p '$A == $A'           # value equality check
ast-grep run -p 'try { $$$ } catch($E) { $$$ }'
```

Use `--debug-query=ast` or `--debug-query=pattern` to inspect how a pattern parses.

## Rewrites

Preview: `ast-grep scan --rule rule.yml src`
Auto-apply: `ast-grep scan --rule rule.yml --update-all src`

Always run formatter + typecheck + tests after rewrites.

Rule format:
```yaml
id: replace-console-log
language: TypeScript
rule:
  pattern: console.log($$$ARGS)
fix: logger.info($$$ARGS)
```

## Repository Standards Setup

1. Inspect languages, vendor paths, existing linters, CI runner
2. Create:
   ```text
   sgconfig.yml
   ast-grep/rules/        ← rule files (.yml)
   ast-grep/rule-tests/   ← test files (.yml)
   ```
3. Configure `sgconfig.yml`:
   ```yaml
   ruleDirs:
     - ast-grep/rules
   testConfigs:
     - testDir: ast-grep/rule-tests
   ```

## Rule Structure

Minimal rule requires:
- `id`: stable kebab-case
- `language`: exact parser name
- `rule.pattern`: the matching pattern
- `message`: concise, actionable
- `note`: remediation guidance (when non-obvious)

Optional: `severity`, `files`, `ignores`, `constraints`, `labels`, `transform`, `fix`.

See [rule-authoring.md](references/rule-authoring.md) for detailed examples.

## Severity Levels

| Level | Policy | Scan behavior |
|---|---|---|
| `error` | Established invariant | Non-zero exit when matched |
| `warning` | Actionable standard | Reports warning |
| `info` | Migration/informational | Reports info |
| `hint` | Low-priority (default) | Reports hint |
| `off` | Temporarily disabled | Does not run |

Promote to `error` only after low false-positive risk is proven. CLI overrides:
```bash
ast-grep scan --error=no-console-log
ast-grep scan --off=no-console-log
```

## Test Every Rule

Every rule must have a corresponding test file whose `id` matches:

```yaml
id: no-console-log
valid:
  - logger.info('ready')       # must NOT report
invalid:
  - console.log('ready')       # MUST report
```

Run during iteration: `ast-grep test --skip-snapshot-tests`
After review: `ast-grep test` (enforces diagnostic layout stability)

For test configuration, see [rule-testing.md](references/rule-testing.md).

## Suppressions

Prefer narrow, ID-specific suppressions:
```ts
// Third-party bootstrap requires direct console output.
console.log(msg); // ast-grep-ignore: no-console-log
```

Avoid bare `ast-grep-ignore`. After baseline cleaning, enforce explicit IDs:
```bash
ast-grep scan --error=no-suppress-all --error=unused-suppression
```

## Troubleshooting and boundaries

- No matches: verify `-l`, quote `$` metavariables, then use `--debug-query=ast`.
- `scan` cannot find config: run from project root or pass `--config sgconfig.yml`.
- Do not use ast-grep for symbol resolution, types, comments, or prose; use ctags, LSP, or `rg`.
- Do not create `sgconfig.yml` for one-off searches.

## Official References

- [Project config](https://astgrep.com/guide/project/project-config)
- [Lint rules](https://astgrep.com/guide/project/lint-rule)
- [Rule tests](https://astgrep.com/guide/test-rule)
- [Severity & suppressions](https://astgrep.com/guide/project/severity)
