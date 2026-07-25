# Gortex Workflow Guide

## Standard Workflow

### 1. Task Initialization

Start every coding task with `gortex_explore`:

```bash
gortex call explore --arg task="implement user authentication"
```

This returns:
- Ranked source files relevant to the task
- Call paths showing code flow
- Symbol locations for key components

### 2. Code Exploration

Use `gortex_search` for discovery:

```bash
# Find symbol definitions
gortex call search --arg operation=symbols --arg query=UserService

# Full-text search
gortex call search --arg operation=text --arg query="handleLogin"

# Find files
gortex call search --arg operation=files --arg query="auth"
```

### 3. Code Reading

Use `gortex_read` for inspection:

```bash
# Read file
gortex call read --arg target='{"file":"src/auth.ts"}'

# Read symbol definition
gortex call read --arg target='{"symbol":"UserService.login"}'

# Get summary
gortex call read --arg target='{"file":"src/auth.ts"}' --arg operation=summary
```

### 4. Understanding Relationships

Use `gortex_relations` to trace code:

```bash
# Find usages
gortex call relations --arg operation=usages --arg id="UserService.login"

# Find callers
gortex call relations --arg operation=callers --arg id="handleLogin"

# Find dependencies
gortex call relations --arg operation=dependencies --arg id="src/auth.ts"
```

### 5. Impact Analysis

Before making changes, check impact:

```bash
gortex call change --arg operation=impact --arg target='{"symbol":"UserService.login"}'
```

This returns:
- Files that would be affected
- Tests that might break
- API contract violations

### 6. Making Edits

Use `gortex_edit` for changes:

```bash
# Edit file
gortex call edit --arg operation=file --arg target='{"file":"src/auth.ts","content":"..."}'

# Edit symbol
gortex call edit --arg operation=symbol --arg target='{"symbol":"UserService.login","content":"..."}'
```

### 7. Post-Edit Verification

After edits, run verification:

```bash
# Detect related changes needed
gortex call change --arg operation=detect --arg target='{"file":"src/auth.ts"}'

# Check affected tests
gortex call change --arg operation=tests --arg target='{"file":"src/auth.ts"}'

# Verify guard conditions
gortex call change --arg operation=guards --arg target='{"file":"src/auth.ts"}'

# Check API contracts
gortex call change --arg operation=contract --arg target='{"file":"src/auth.ts"}'
```

### 8. Code Review

Review changes with graph context:

```bash
gortex call review --arg target='{"file":"src/auth.ts"}'
```

---

## Task-Specific Workflows

### Bug Fix

1. `gortex_explore` with bug description
2. `gortex_search` for error message or symptom
3. `gortex_trace` to find root cause
4. `gortex_change` with `operation=impact` before fix
5. `gortex_edit` to apply fix
6. `gortex_change` with `operation=tests,guards` after fix

### Feature Addition

1. `gortex_explore` with feature description
2. `gortex_search` for related symbols
3. `gortex_relations` to understand existing patterns
4. `gortex_change` with `operation=impact` for new code
5. `gortex_edit` to add feature
6. `gortex_change` with `operation=contract` to verify API consistency

### Refactoring

1. `gortex_explore` with refactoring goal
2. `gortex_search` for target symbols
3. `gortex_relations` to find all usages
4. `gortex_change` with `operation=impact` for scope
5. `gortex_refactor` to apply changes
6. `gortex_change` with `operation=detect,tests,guards,contract` for verification

### Code Review

1. `gortex_pr` to inspect PR changes
2. `gortex_review` for graph-contextual review
3. `gortex_publish_review` to submit feedback

---

## Output Formats

### Default (JSON)
```bash
gortex call search --arg operation=symbols --arg query=UserService
```

### Compact (GCX)
```bash
gortex call search --arg operation=symbols --arg query=UserService --arg output='{"format":"gcx"}'
```

### Compressed
```bash
gortex call read --arg target='{"file":"src/auth.ts"}' --arg options='{"compress_bodies":true}'
```

---

## Tips

1. **Start broad, narrow down**: Use `explore` first, then `search` for specifics
2. **Check impact before edits**: Always run `change` with `operation=impact` first
3. **Verify after changes**: Run all relevant `change` operations after edits
4. **Use relations**: Understanding call chains prevents breaking changes
5. **Trust the graph**: Gortex knows more about your code than grep/find

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Not tracked" error | Run `gortex init` in repo root |
| Daemon not running | Run `gortex daemon start --detach` |
| Missing symbols | Run `gortex track ~/path/to/repo` |
| Stale index | Run `gortex daemon restart` |
| Tool not found | Use `gortex_capabilities` to list available tools |
