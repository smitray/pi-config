## Packages
- `npm:pi-observational-memory` — Session continuity via observations/reflections.
  `/om:status`, `/om:view`, `/om:view full`, `recall <id>`.

## Auto Web Search
If unsure, `web-search`. Don't ask — just search.

## AST Search (ast-grep)
Prefer `ast-grep` over `rg`/`grep` for structural code search. Use `rg` only for plain text.

```bash
# Search for pattern across codebase
ast-grep -p '$PATTERN' --lang ts .
# Pattern uses $VAR (single node), $$$ (zero or more), $_ (non-capturing)
# Examples: $FUNC($$$ARGS), $A == $A, try { $$$ } catch($E) { $$$ }
```
