import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { registerMarkitdownTools } from './tools/convert';

const skillsDir = join(dirname(fileURLToPath(import.meta.url)), 'skills');

/**
 * markitdown — Microsoft MarkItDown integration.
 *
 * Converts PDF, DOCX, PPTX, XLSX, images, audio, HTML, and more to clean
 * Markdown for LLM pipelines. Wraps the `markitdown` pip package CLI.
 *
 * DFD:
 *   1. web-access fetch → markitdown → agent/desired path
 *   2. kb capture → web-access fetch → markitdown → kb/raw
 *   3. OCR pipeline → markitdown → kb/agent
 */
export default function markitdownExtension(pi: ExtensionAPI): void {
  registerMarkitdownTools(pi);

  pi.on('resources_discover', () => ({ skillPaths: [skillsDir] }));
}
