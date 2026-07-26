# Gortex Tools Reference

All Gortex tools are prefixed with `gortex_` in Pi. Use `gortex call <tool>` for CLI access.

## Exploration & Discovery

| Tool | Description | Key Args |
|------|-------------|----------|
| `gortex_explore` | Localize task, return ranked source + call paths | `task` (required) |
| `gortex_search` | Search symbols, text, files, AST shapes | `operation`, `query` |
| `gortex_read` | Read files, symbols, summaries, editing context | `target`, `operation` |
| `gortex_capabilities` | Get exact operations and request schemas | - |

## Code Analysis

| Tool | Description | Key Args |
|------|-------------|----------|
| `gortex_relations` | Find usages, callers, dependencies, implementations | `operation`, `id` |
| `gortex_trace` | Trace call chains, value flow, taint paths | `from`, `to` |
| `gortex_analyze` | Run graph analysis (use `kind=help` to list) | `kind`, `params` |
| `gortex_ask` | Answer codebase question from graph evidence | `question` |

## Mutation & Refactoring

| Tool | Description | Key Args |
|------|-------------|----------|
| `gortex_change` | Plan/check mutations: impact, verify, detect, tests, guards, contract | `operation`, `target` |
| `gortex_edit` | Apply file, symbol, batch, or new-file edits | `operation`, `target` |
| `gortex_refactor` | Rename, move, inline, delete, apply code actions | `operation`, `target` |

## Review & PR

| Tool | Description | Key Args |
|------|-------------|----------|
| `gortex_review` | Review changes with graph context | `target` |
| `gortex_publish_review` | Publish prepared review feedback | `target` |
| `gortex_pr` | Inspect pull-request changes, context, risk | `target` |

## Memory & State

| Tool | Description | Key Args |
|------|-------------|----------|
| `gortex_recall` | Retrieve notes/memories relevant to work | `query` |
| `gortex_remember` | Store durable decisions, invariants, gotchas | `content`, `tags` |
| `gortex_session` | Manage session state or subscriptions | `operation` |
| `gortex_overlay` | Compare/manage session overlay state | `operation` |

## Workspace

| Tool | Description | Key Args |
|------|-------------|----------|
| `gortex_workspace` | Inspect workspace/repository state | - |
| `gortex_workspace_admin` | Perform explicit workspace administration | `operation` |

## Output Control

| Tool | Description | Key Args |
|------|-------------|----------|
| `gortex_response` | Control response encoding or pagination | `format`, `compress` |

---

## Common Operations

### search operations
- `symbols` - Find symbol definitions
- `text` - Full-text search
- `files` - Find files by name/path
- `ast` - AST pattern matching

### read operations
- `file` - Read file contents
- `symbol` - Read symbol definition
- `summary` - Get file/symbol summary
- `editing_context` - Get context for editing

### change operations
- `impact` - Check what would break
- `verify` - Verify change safety
- `detect` - Detect related changes needed
- `tests` - Find affected tests
- `guards` - Check guard conditions
- `contract` - Verify API contracts

### relations operations
- `usages` - Find where symbol is used
- `callers` - Find who calls function
- `callees` - Find what function calls
- `dependencies` - Find dependencies
- `dependents` - Find dependents
- `implementations` - Find implementations

---

## Tool Arguments

Each tool accepts different arguments. Use `gortex_capabilities` to get exact schemas:

```bash
gortex call capabilities
```

Or check specific tool:
```bash
gortex call search --help
```

## Error Handling

If a Gortex tool fails:
1. Check error message for cause
2. Verify repo is indexed (`./scripts/check-indexed.sh`)
3. Fall back to built-in tools if Gortex can't handle the request
