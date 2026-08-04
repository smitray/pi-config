---
name: code-intel
description: >
  Code intelligence via ctags + ast-grep. Use when finding symbol definitions,
  call sites, callers/callees, or blast radius ("what breaks if I change X").
  Combines ctags symbol index with ast-grep structural search for cross-file
  code exploration without loading full files.
license: MIT
metadata:
  author: "Debasmit"
---

# code-intel

Native code intelligence without a knowledge graph daemon. Ctags (symbol index) + ast-grep (structural search).

## When to use

| Need | Tool |
|---|---|
| Find symbol definition | ctags |
| Find all call sites of a function | ast-grep |
| Blast radius ("what breaks if I change X") | ctags + ast-grep iterative |

For detailed ast-grep pattern syntax, see `ast-grep` skill. For text search in comments/docs, use `rg`. For type-aware navigation, use LSP.

## Symbol indexing with ctags

Generate once per session:
```bash
ctags -R --fields=+nKsS --extras=+q .
```

Search:
```bash
grep -P '^myFunction\t' tags                    # find definition
grep -P '\tmyfile\.ts\t' tags                   # all symbols in a file
```

Tags format: `symbolName\tpath\tline;"\tkind:function\tline:N`

## Call-site finding

```bash
ast-grep run -p 'myFunction($$$)' -l ts src/    # direct calls
ast-grep run -p '$OBJ.method($$$)' -l ts src/   # method calls on objects
ast-grep run -p '$OBJ.method1($$$).method2($$$)' -l ts src/  # chained
```

Use `--json=compact` for scripting: `jq -r '.[].file'`.

## Blast radius

"What breaks if I change function X?"

```bash
# Step 1: Direct callees
ast-grep run -p 'myFunction($$$)' -l ts src/ --json=compact | jq -r '.[].file' | sort -u

# Step 2: Repeat on each caller for transitive impact
```

Script as `blast-radius.sh <function> <language> [dir]`, iterate until no new files found.
