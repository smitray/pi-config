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

Native code intelligence without a knowledge graph daemon. Ctags (persistent symbol index) + ast-grep (stateless structural search).

`ctags` creates `tags`. ast-grep does not create an index file; it parses requested source paths on demand.

## When to use

| Need | Tool |
|---|---|
| Find symbol definition | ctags |
| Find all call sites of a function | ast-grep |
| Blast radius ("what breaks if I change X") | ctags + ast-grep iterative |

For detailed ast-grep pattern syntax, see `ast-grep` skill. For text search in comments/docs, use `rg`. For type-aware navigation, use LSP.

## Symbol indexing with ctags

Generate or refresh persistent `tags` for source code. Exclude dependencies and generated files:

```bash
ctags -R \
  --exclude=.git --exclude=node_modules --exclude=dist --exclude=coverage \
  --fields=+nKsS --extras=+q -f tags .
```

For this workspace, `extensions/` is the custom source tree. Use this instead if you want an extension-local index:

```bash
ctags -R --exclude=node_modules --exclude=dist --exclude=coverage \
  --fields=+nKsS --extras=+q -f extensions/tags extensions/
```

Search:
```bash
grep -P '^myFunction\t' tags                    # find definition
grep -P '\tmyfile\.ts\t' tags                   # all symbols in a file
```

Tags format: `symbolName\tpath\tline;"\tkind:function\tline:N`

Refresh `tags` after adding or moving symbols. It is an index, not source of truth; inspect source before changing code.

## Call-site finding

Point ast-grep at the source tree. No setup or generated file required:

```bash
ast-grep run -p 'myFunction($$$)' -l ts extensions --globs '!node_modules/**'    # direct calls
ast-grep run -p '$OBJ.method($$$)' -l ts extensions --globs '!node_modules/**'   # method calls on objects
ast-grep run -p '$OBJ.method1($$$).method2($$$)' -l ts extensions --globs '!node_modules/**'  # chained
```

Use `--json=compact` for scripting: `jq -r '.[].file'`.

## Blast radius

"What breaks if I change function X?"

```bash
# Step 1: Direct callers
ast-grep run -p 'myFunction($$$)' -l ts extensions \
  --globs '!node_modules/**' --json=compact | jq -r '.[].file' | sort -u

# Step 2: Repeat on each caller for transitive impact
```

Script as `blast-radius.sh <function> <language> [dir]`, iterate until no new files found.

## Boundaries

- ctags finds declarations and symbol metadata, not reliable call graphs or types.
- ast-grep finds syntactic matches, not semantic references; account for aliases, dynamic calls, and shadowing.
- Use LSP for type-aware definitions and references. Use `rg` for comments and string literals.
