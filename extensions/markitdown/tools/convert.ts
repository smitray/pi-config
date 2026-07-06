import { existsSync } from 'node:fs';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { runCommand } from '../../_shared/spawn';

/**
 * Register markitdown conversion tool.
 *
 * Provides `markitdown-convert` — converts a local file to Markdown
 * using Microsoft's MarkItDown Python CLI.
 */
export function registerMarkitdownTools(pi: ExtensionAPI): void {
  pi.registerTool(markitdownConvert);
}

interface MarkitdownConvertArgs {
  /** Path to the file to convert. */
  path: string;
  /** Timeout in ms (default 60000). PDFs/image OCR can be slow. */
  timeoutMs?: number;
}

async function handleMarkitdownConvert(args: MarkitdownConvertArgs): Promise<{
  ok: boolean;
  content?: string;
  error?: string;
  format?: string;
}> {
  if (!existsSync(args.path)) {
    return { ok: false, error: `File not found: ${args.path}` };
  }

  const ext = args.path.split('.').pop()?.toLowerCase() ?? '';
  const formatMap: Record<string, string> = {
    pdf: 'PDF',
    docx: 'Word',
    pptx: 'PowerPoint',
    xlsx: 'Excel',
    xls: 'Excel',
    html: 'HTML',
    htm: 'HTML',
    csv: 'CSV',
    json: 'JSON',
    xml: 'XML',
    epub: 'EPUB',
    jpg: 'Image',
    jpeg: 'Image',
    png: 'Image',
    webp: 'Image',
    gif: 'Image',
    bmp: 'Image',
    svg: 'Image',
    mp3: 'Audio',
    wav: 'Audio',
    m4a: 'Audio',
    txt: 'Text',
    md: 'Markdown',
    zip: 'ZIP',
  };

  const result = await runCommand('markitdown', [args.path], {
    timeoutMs: args.timeoutMs ?? 60000,
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.stderr || result.error || 'markitdown failed',
      format: formatMap[ext] ?? 'Unknown',
    };
  }

  return {
    ok: true,
    content: result.stdout,
    format: formatMap[ext] ?? 'Unknown',
  };
}

// Tool metadata for pi registration
const markitdownConvert = {
  name: 'markitdown-convert',
  description:
    'Convert a local file (PDF, DOCX, PPTX, XLSX, images, audio, HTML, CSV, JSON, XML, EPUB) to Markdown using Microsoft MarkItDown.',
  args: [
    {
      name: 'path',
      type: 'string' as const,
      description: 'Path to the local file to convert',
      required: true,
    },
    {
      name: 'timeoutMs',
      type: 'number' as const,
      description: 'Timeout in ms (default 60000). Increase for large PDFs or OCR-heavy images.',
      required: false,
    },
  ],
  handler: handleMarkitdownConvert,
};

export { markitdownConvert };
