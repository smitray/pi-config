# Rule Testing Guide

## Test File Structure

Test file name must match rule `id`:

```text
ast-grep/rules/no-console-log.yml       # Rule
ast-grep/rule-tests/no-console-log.yml   # Test (same id)
```

```yaml
id: no-console-log
valid:                                    # Must NOT report
  - logger.info('ready')
  - console.error('fatal')
invalid:                                  # MUST report
  - console.log('ready')
  - console.log(message, context)
```

## What to Cover

Each test file should cover:

1. **Plausible valid code** — realistic code that must not trigger (prevents false positives)
2. **Every prohibited form** — each variant of the violation (prevents false negatives)
3. **Boundaries** — nesting, alternate syntax, structural edge cases

## Running Tests During Iteration

```bash
# Detection only (skip diagnostic layout comparison)
ast-grep test --skip-snapshot-tests

# After review complete (enforce layout stability)
ast-grep test

# Update all snapshot tests
ast-grep test --update-all
```

## Regression Testing

When fixing a rule:
1. Add a failing `valid` or `invalid` case first
2. Confirm the expected noisy or missing failure
3. Fix the rule
4. Verify with `ast-grep test`

## Path Verification

`valid`/`invalid` snippets don't exercise `files`/`ignores`. Verify paths separately:

```bash
ast-grep scan --inspect entity        # shows which files the rule actually touches
```

## Snapshot Tests

Snapshot tests compare diagnostic output layout. Skip them when:
- Diagnostics are intentionally unstable across environments
- Only detection (not diagnostics) is the contract

Never use interactive snapshot updates in CI (`ast-grep test --update-all`).
