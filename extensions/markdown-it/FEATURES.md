# markdown-it Extension

AST-based markdown parsing for chunking, structure extraction, and validation.

## Features

- **`extractSections(markdown)`** — split markdown into heading-based sections
- **`chunkByHeadings(markdown, maxTokens)`** — chunk by headings with token budget
- **`validateMarkdown(markdown)`** — syntax validation (unmatched brackets/parens)

## Consumers

| Extension | Import | What it uses |
|-----------|--------|--------------|
| web-access | `../../markdown-it/lib/markdown-it` | Available for section-aware chunking |
| kb | (planned) | Markdown frontmatter + content parsing |
| OCR pipeline | (planned) | OCR → markdown-it → KB/agent |

## Dependencies

- `markdown-it@^14.2.0` (npm — project-level dep)
