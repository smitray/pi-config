# Command Reference — All ast-grep Commands

## run (Search)

Find files matching a pattern.

```bash
ast-grep run --lang <lang> --pattern '<PATTERN>' [path]
```

Parameters:
| Param | Notes |
|---|---|
| `--lang` | Language filter (`typescript`, `python`, `go`, `rust`, etc.) |
| `--pattern` / `-p` | AST search pattern (required) |
| `--json` | Output format: `compact` for JSON Lines, other values for pretty output |
| `--debug-query` | `ast` prints query pattern's AST, `pattern` prints parsed rule structure |
| `--config` | Path to sgconfig.yml |
| `--include-metadata` | Include source metadata in output |
| `path` | Directory/file to search (default: current directory) |

Examples:
```bash
ast-grep run -l typescript -p 'console.log($$$ARGS)' src
ast-grep run -l python -p 'print($$$ARGS)' . --json=compact | jq -r '.[].file'
ast-grep run -p '$FUNC($$$ARGS)' --debug-query=ast src/example.ts
```

## scan (Lint)

Scan files using rules from sgconfig.yml or a single rule file.

```bash
ast-grep scan [--rule <file>] [--inspect summary|entity] [path]
```

Parameters:
| Param | Notes |
|---|---|
| `--rule` / `-r` | Single rule YAML file |
| `--update-all` / `-u` | Auto-apply fixes |
| `--inspect` | `summary` for overview, `entity` for per-rule details |
| `--error=` | Override severity to error (e.g., `--error=no-console-log`) |
| `--off=` | Override severity to off |
| `--pretty` / `--stream` / `--compact` | Output format |

Projects require `sgconfig.yml`. Project discovery walks upward from cwd. Use `--config` when invoking from elsewhere.

```bash
ast-grep scan                           # uses sgconfig.yml
ast-grep scan --rule rule.yml src       # single rule
ast-grep scan --inspect summary         # project overview
ast-grep scan --error=rule-id           # override severity
```

## test

Run rule tests. Tests come from corresponding `.yml` files in `rule-tests/`.

```bash
ast-grep test [--skip-snapshot-tests] [--update-all]
```

Parameters:
| Param | Notes |
|---|---|
| `--skip-snapshot-tests` | Skip diagnostic layout comparison |
| `--update-all` / `-U` | Update all snapshot tests |

Keep `--skip-snapshot-tests` permanent only when diagnostics are intentionally unstable. Never use interactive snapshot updates in CI.

## debug-query Examples

When a pattern doesn't match, inspect its parse tree:

```bash
# Parse the QUERY pattern itself
ast-grep run -p 'console.log($$$ARGS)' --debug-query=ast src/ex.ts

# Parse the SOURCE file's AST at match point
ast-grep run -p 'console.log($$$ARGS)' --debug-query=pattern src/ex.ts
```

The playground at https://sg.am is useful for testing patterns visually.
