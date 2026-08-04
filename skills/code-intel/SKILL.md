---
name: code-intel
description: >
  Code intelligence via ctags + ast-grep. Use when finding symbol definitions,
  call sites, callers/callees, or blast radius ("what breaks if I change X").
  Combines ctags symbol index with ast-grep structural search for cross-file
  code exploration without loading full files.
---

# code-intel

Native code intelligence without a knowledge graph daemon. Combines ctags (symbol index) with ast-grep (structural search) for definition lookup, call-site finding, and blast-radius queries.

## When to use

| Need | Tool |
|---|---|
| Find symbol definition | ctags |
| Find all call sites of a function | ast-grep |
| Find all references to a symbol | ctags + ast-grep |
| Blast radius ("what breaks if I change X") | ctags + ast-grep (iterative) |
| Quick file overview | ctags (tags file) |
| Structural pattern search | ast-grep |

Use rg for text search (comments, strings, docs). Use LSP for type-aware navigation when a language server is running.

## Symbol indexing with ctags

Generate a tags file for quick symbol lookup:

```bash
# Generate tags for current directory
ctags -R --fields=+nKsS --extras=+q .

# Generate tags for specific languages
ctags -R --languages=TypeScript,JavaScript --fields=+n .

# Generate tags to stdout (no file)
ctags -R -f - --fields=+n .
```

Search the tags file:

```bash
# Find definition of a symbol
grep -P '^functionName\t' tags

# Find all symbols in a file
grep -P '\tmyfile\.ts\t' tags

# Find all functions
grep -P '\tfunction\t' tags

# Find all classes
grep -P '\tclass\t' tags
```

### Tags file format

```
symbolName\tfilePath\tlineNumber;"\tkind:function\tline:42
```

Fields:
- `symbolName` — the symbol
- `filePath` — relative path
- `lineNumber` — line in file
- `kind` — function, class, variable, etc.
- `line` — line number (redundant with lineNumber)

## Call-site finding with ast-grep

Find where a function is called:

```bash
# TypeScript/JavaScript
ast-grep run -p 'functionName($$$)' -l ts src/

# Python
ast-grep run -p 'functionName($$$)' -l py .

# Go
ast-grep run -p 'functionName($$$)' -l go .

# Rust
ast-grep run -p 'functionName($$$)' -l rs .
```

Find method calls on objects:

```bash
# obj.method($$$)
ast-grep run -p '$OBJ.method($$$)' -l ts src/

# Chained calls
ast-grep run -p '$OBJ.method1($$$).method2($$$)' -l ts src/
```

Find function definitions:

```bash
# Regular function
ast-grep run -p 'function $NAME($$$) { $$$ }' -l ts src/

# Arrow function
ast-grep run -p 'const $NAME = ($$$) => { $$$ }' -l ts src/

# Class method
ast-grep run -p '$NAME($$$) { $$$ }' -l ts src/
```

## Combined: full reference lookup

Find all references to a symbol (definition + call sites):

```bash
# 1. Find definition via ctags
grep -P '^myFunction\t' tags

# 2. Find call sites via ast-grep
ast-grep run -p 'myFunction($$$)' -l ts src/
```

Or combine in one pipeline:

```bash
# All references (definition + calls)
{ grep -P '^myFunction\t' tags | cut -f1-2; ast-grep run -p 'myFunction($$$)' -l ts src/ --json=compact | jq -r '.[].file'; } | sort -u
```

## Blast radius

"What breaks if I change function X?"

Iterative approach:

```bash
# Step 1: Find direct callers
ast-grep run -p 'myFunction($$$)' -l ts src/ --json=compact | jq -r '.[].file' | sort -u

# Step 2: For each caller, find ITS callers
# (repeat until no new files)
```

Script version:

```bash
#!/bin/bash
# blast-radius.sh <function-name> <language> [directory]
FN=$1; LANG=$2; DIR=${3:-.}
SEEN=$(mktemp)
ast-grep run -p "$FN($$$)" -l "$LANG" "$DIR" --json=compact | jq -r '.[].file' | sort -u > "$SEEN"
# One level deeper: find what calls the callers
while read -r file; do
  # Get functions defined in this file
  ctags -f - "$file" | grep -P '\tfunction\t' | cut -f1 | while read -r caller; do
    ast-grep run -p "$caller($$$)" -l "$LANG" "$DIR" --json=compact | jq -r '.[].file' >> "$SEEN"
  fi
done < "$SEEN"
sort -u "$SEEN"
rm "$SEEN"
```

## Language-specific patterns

### TypeScript / JavaScript

```bash
# Find all exports
ast-grep run -p 'export function $NAME($$$) { $$$ }' -l ts src/
ast-grep run -p 'export const $NAME = ($$$) => { $$$ }' -l ts src/

# Find all imports of a module
ast-grep run -p "import { $$$ } from '$MODULE'" -l ts src/

# Find all React components
ast-grep run -p 'export function $NAME($$$) { return $$$ }' -l tsx src/

# Find all async functions
ast-grep run -p 'async function $NAME($$$) { $$$ }' -l ts src/
```

### Python

```bash
# Find all class definitions
ast-grep run -p 'class $NAME($$$): $$$' -l py .

# Find all method definitions in a class
ast-grep run -p 'def $NAME(self, $$$): $$$' -l py .

# Find all decorators
ast-grep run -p '@$DECORATOR' -l py .
```

### Go

```bash
# Find all struct methods
ast-grep run -p 'func ($RECEIVER *$TYPE) $NAME($$$) $$$ { $$$ }' -l go .

# Find all interface implementations
ast-grep run -p 'func ($RECEIVER *$TYPE) $NAME($$$) $$$ { $$$ }' -l go .
```

## Structured output

For scripting and automation:

```bash
# JSON output (one object per match)
ast-grep run -p 'myFunction($$$)' -l ts src/ --json=compact

# Extract just file paths
ast-grep run -p 'myFunction($$$)' -l ts src/ --json=compact | jq -r '.[].file'

# Extract file + line
ast-grep run -p 'myFunction($$$)' -l ts src/ --json=compact | jq -r '.[] | "\(.file):\(.range.start.line)"'
```

## Tips

- Generate tags file once per session, update on change: `ctags -R --fields=+n .`
- Use `--json=compact` with ast-grep for machine-readable output
- Combine ctags (fast symbol lookup) with ast-grep (precise structural matching)
- For large codebases, scope searches to specific directories
- Use `ast-grep run -p 'pattern' --debug-query=ast` when patterns don't match
