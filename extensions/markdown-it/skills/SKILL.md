---
name: markdown-it
description: AST-based markdown parsing for chunking, structure extraction, and validation
---

# markdown-it

Use the `extractSections`, `chunkByHeadings`, and `validateMarkdown` functions from `extensions/markdown-it/lib/markdown-it` when you need to:

- Split markdown into heading-delimited sections (`extractSections`)
- Chunk large markdown for LLM context windows (`chunkByHeadings`)
- Validate markdown syntax before saving (`validateMarkdown`)

Import path: `import { extractSections, chunkByHeadings, validateMarkdown } from '../../markdown-it/lib/markdown-it'`
