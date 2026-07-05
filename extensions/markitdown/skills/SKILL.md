---
name: markitdown
description: Convert files (PDF, DOCX, PPTX, XLSX, images, audio, HTML) to Markdown using Microsoft MarkItDown
---

# markitdown

Use the `markitdown-convert` tool when you need to convert non-markdown files to clean Markdown for LLM consumption.

**Supported formats:** PDF, DOCX, PPTX, XLSX, images (JPG, PNG, WebP, GIF, BMP, SVG), audio (MP3, WAV, M4A), HTML, CSV, JSON, XML, EPUB, ZIP

**Prerequisites:** `pip install 'markitdown[all]'`

**Usage:**
```
markitdown-convert path:/path/to/file.pdf
markitdown-convert path:/path/to/file.docx
markitdown-convert path:/path/to/image.png timeoutMs:120000
```

For web-crawled content, first download the file then pass the local path.
