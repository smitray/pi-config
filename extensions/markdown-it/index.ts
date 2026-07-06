import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

const skillsDir = join(dirname(fileURLToPath(import.meta.url)), 'skills');

/**
 * markdown-it extension — AST-based markdown parsing for chunking, structure
 * extraction, and validation.
 *
 * Exports are imported by other extensions (web-access, kb, OCR pipeline) via
 * `../../markdown-it/lib/markdown-it`. No runtime tools registered — this is a
 * library extension consumed at import time.
 */
export default function markdownItExtension(pi: ExtensionAPI): void {
  pi.on('resources_discover', () => ({ skillPaths: [skillsDir] }));
}
