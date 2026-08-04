# Rule Authoring Guide

## Minimal Rule

```yaml
id: no-console-log
language: TypeScript
rule:
  pattern: console.log($$$ARGS)
message: Use the project logger instead of console.log.
note: Replace console.log with the logger appropriate to this module.
```

Every rule needs:
- `id`: kebab-case, stable across versions
- `language`: exact parser name (e.g., `TypeScript`, `Python`, `Go`)
- `rule.pattern`: the matching AST pattern
- `message`: actionable, concise description
- `note`: remediation when not obvious

## Complete Rule Structure

```yaml
id: no-console-log              # Required: stable kebab-case identifier
language: TypeScript            # Required: exact tree-sitter parser name
severity: warning               # Optional: error|warning|info|hint|off (default: hint)
files:                          # Optional: glob paths relative to sgconfig.yml
  - src/**/*.ts
ignores:                        # Optional: glob paths to exclude
  - src/generated/**
message: Use the project logger.   # Required: actionablenotice
note: See docs/internal-logger.md    # Recommended: remediation guidance
rule:                           # Required: the rule object
  pattern: console.log($$$ARGS)
  # OR composed rules below
fix: logger.info($$$ARGS)       # Optional: auto-fix
```

### File Globs

`files` and `ignores` are relative to `sgconfig.yml`. Never prefix globs with `./`.

```yaml
files:
  - src/**/*.ts
  - src/**/*.tsx
ignores:
  - src/generated/**
  - tests/fixtures/**
```

## Rule Composition

For complex patterns beyond simple `pattern:` matches:

```yaml
rule:
  all:                           # All conditions must match
    - pattern: "console.log($$)"
    - kind: "argument"
  any:                           # Any one condition
    - pattern: "print()"
    - pattern: "console.log()"
  not:                           # Must NOT match
    - pattern: "__DEBUG__"
```

Constraints filter after main rule matches. Apply only to single metavariables:
```yaml
rule:
  pattern: "$FUNC($$$ARGS)"
  constraints:
    FUNC:
      kind: "function_declaration"
```

## Labels

Add labels for structured metadata in output:
```yaml
rule:
  labels:
    - performance
    - security
```

## Transformations

Replace matched nodes with new AST:
```yaml
rule:
  transform:
    $VAR: some_rewrite_expr($$$ARGS)
```

See [official rule reference](https://astgrep.com/guide/project/lint-rule) for full composition syntax.
