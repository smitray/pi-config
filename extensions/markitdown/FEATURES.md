# markitdown Extension

Microsoft MarkItDown integration — convert various file formats to clean Markdown for LLM pipelines.

## Features

- **`markitdown-convert` tool** — convert local files to Markdown
- **Supported formats:** PDF, DOCX, PPTX, XLSX, images (EXIF + OCR), audio (speech transcription), HTML, CSV, JSON, XML, EPUB, ZIP
- **LLM-ready output** — preserves headings, lists, tables, links

## DFD

```
web-access fetch → markitdown → agent / desired location
kb capture → web-access → markitdown → kb/raw
OCR pipeline → markitdown → kb/agent
```

## Prerequisites

```bash
pip install 'markitdown[all]'
```

## Usage

```bash
markitdown path-to-file.pdf -o output.md   # CLI direct
```

In pi, use the `markitdown-convert` tool with a local file path.

## Related

- [markdown-it](../markdown-it/) — npm-based markdown parser (AST chunking, sections, validation)
