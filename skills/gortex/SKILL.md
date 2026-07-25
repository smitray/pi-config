---
name: gortex
description: >
  Graph-based code intelligence for Gortex-indexed repositories.
  Use before read/bash/grep/find/edit operations to check if repo is indexed
  and replace with Gortex tools. Triggers on file reads, code search, symbol
  lookup, refactoring, and code reviews in indexed repos.
---

# Gortex Code Intelligence

## Mandatory Pre-check

**Before using `read`, `bash` (with cat/head/tail/grep/find), `grep`, or `find`:**

Run the index check script:
```bash
./scripts/check-indexed.sh
```

**If indexed:** Use Gortex tools from the mapping table below.
**If not indexed:** Use built-in tools normally.

## Tool Mapping

| Built-in Tool | Gortex Replacement | When |
|---------------|-------------------|------|
| `read` | `gortex_read` | Reading files, symbols, summaries |
| `bash cat/head/tail` | `gortex_read` | Source file inspection |
| `bash rg/grep` | `gortex_search` | Searching code |
| `bash find` | `gortex_search` | Finding files |
| `edit` | `gortex_edit` | Making changes |
| `bash git diff` | `gortex_review` | Reviewing changes |

## Quick Workflow

1. **Start task:** `gortex_explore` with task description
2. **Search:** `gortex_search` for symbols/text
3. **Read:** `gortex_read` for file/symbol inspection
4. **Before edit:** `gortex_change` with `operation=impact`
5. **After edit:** `gortex_change` with `operation=detect,tests,guards`

## Fallback Rules

Use built-in tools when:
- File is outside tracked repo
- Gortex tool returns error
- Operation not available in Gortex (e.g., running tests)

## Detailed References

- [Complete Gortex Tools](references/gortex-tools.md)
- [Workflow Guide](references/gortex-workflow.md)
