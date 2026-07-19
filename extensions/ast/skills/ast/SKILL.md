---
name: ast
description: AST-based code search/replace (ast-grep) + structural code intelligence (codebase-memory-mcp).
---

# Code Search & Intelligence

Two complementary toolchains:

## 1. AST patterns (`ast_grep_*`) — semantic pattern matching
Use **ast-grep CLI** for pattern-based refactors and search. Understands code structure.

| Tool | Use |
|------|-----|
| `ast_grep_search({ pattern, paths?, lang? })` | Find matches |
| `ast_grep_replace({ pattern, rewrite, paths?, apply? })` | Replace (dry-run unless `apply: true`) |

**Metavariables:** `$X` (single node), `$$$` (zero+ wildcards), `$$$NAME` (captured).

## 2. Code intelligence (`code_*`) — graph-based via codebase-memory-mcp
Use **codebase-memory-mcp** for navigation, call-graph tracing, and architecture understanding. 158 languages, sub-ms queries, 99% fewer tokens vs grep.

| Tool | Use |
|------|-----|
| `code_search({ project, pattern, label? })` | Find functions/classes by regex |
| `code_trace({ project, function, direction?, depth? })` | Callers/callees graph traversal |
| `code_architecture({ project })` | Languages, packages, routes, hotspots |
| `code_index({ path })` | Index a repo (first time only) |

## When to Use Which

- **Need to refactor a pattern across files?** → `ast_grep_replace`
- **Need to find where a function is called?** → `code_trace`
- **Need to find all classes matching a regex?** → `code_search`
- **Need to understand a new codebase?** → `code_architecture`
- **Need type info / definitions / references?** → LSP (see `/skill:lsp`)
- **Need plain text search?** → grep

## Setup

codebase-memory-mcp is already installed at `~/.local/bin/codebase-memory-mcp` and `~/.pi/agent/` is auto-indexed (project: `home-debasmitr-.pi-agent`). For other repos, run `code_index({ path })` first.