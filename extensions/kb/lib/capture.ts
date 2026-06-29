import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { basename, join } from 'node:path';
import { approxTokens, splitIntoChunks } from '../../web-access/lib/markdown';
import type { VaultPaths } from './vault';
import { fmtDate, writeJson } from './vault';

// ponytail: capture file or text into immutable raw/sources/SRC-* packet.
// URL capture deferred to a skill that uses web-access → drops into raw/ → ingest picks it up.

function nextSourceId(paths: VaultPaths): string {
  if (!existsSync(paths.rawSources)) {
    mkdirSync(paths.rawSources, { recursive: true });
  }
  // Read from disk to avoid module-level counter resets
  const existing = readdirSync(paths.rawSources, { withFileTypes: true })
    .filter((d: { isDirectory: () => boolean }) => d.isDirectory())
    .map((d: { name: string }) => d.name);
  let maxN = 0;
  for (const name of existing) {
    const m = name.match(/^SRC-\d{4}-\d{2}-\d{2}-(\d{3})$/);
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  }
  const padded = String(maxN + 1).padStart(3, '0');
  return `SRC-${fmtDate()}-${padded}`;
}

export function captureFile(
  filePath: string,
  title: string,
  paths: VaultPaths
): { sourceId: string; packetDir: string } {
  const sourceId = nextSourceId(paths);
  const packetDir = join(paths.rawSources, sourceId);
  mkdirSync(join(packetDir, 'original'), { recursive: true });

  // Copy original
  const destFile = join(packetDir, 'original', basename(filePath));
  copyFileSync(filePath, destFile);

  // Extract text content
  let extracted = '';
  const ext = basename(filePath).split('.').pop()?.toLowerCase() || '';

  // Ponytail: PDFs are binary; force user to run pdftotext first.
  // Scanned PDFs need OCR — defer to a future skill.
  if (ext === 'pdf') {
    throw new Error(
      `PDF detected (${basename(filePath)}). Run \`pdftotext ${filePath} output.txt\` first, ` +
        `then capture the .txt file. For scanned PDFs, use an OCR tool before capture.`
    );
  }

  try {
    extracted = readFileSync(filePath, 'utf-8');
    // Wrap in markdown code fence if not already markdown
    if (!['md', 'txt'].includes(ext)) {
      extracted = `\`\`\`${ext}\n${extracted}\n\`\`\``;
    }
  } catch (e) {
    const msg =
      (e as NodeJS.ErrnoException).code === 'ENOENT'
        ? `File not found: ${filePath}`
        : `Cannot read ${filePath}: ${(e as Error).message}`;
    throw new Error(msg);
  }

  writeFileSync(join(packetDir, 'extracted.md'), extracted, 'utf-8');

  const manifest = {
    sourceId,
    type: 'file' as const,
    title,
    originalPath: filePath,
    captured: new Date().toISOString(),
    status: 'pending' as const,
  };
  writeJson(join(packetDir, 'manifest.json'), manifest);

  return { sourceId, packetDir };
}

/**
 * Maximum tokens before chunking extracted content.
 * ponytail: 4000 tokens ≈ 3000 words. Enough for most sources.
 * Upgrade to configurable if users hit this limit often.
 */
const MAX_EXTRACTED_TOKENS = 4000;

export function captureText(
  text: string,
  title: string,
  paths: VaultPaths
): { sourceId: string; packetDir: string } {
  const sourceId = nextSourceId(paths);
  const packetDir = join(paths.rawSources, sourceId);
  mkdirSync(join(packetDir, 'original'), { recursive: true });

  // Store original text
  writeFileSync(join(packetDir, 'original', 'content.txt'), text, 'utf-8');

  // Chunk large content
  const tokens = approxTokens(text);
  let extracted = text;
  if (tokens > MAX_EXTRACTED_TOKENS) {
    const chunks = splitIntoChunks(text, MAX_EXTRACTED_TOKENS);
    extracted = chunks.join('\n\n---\n\n');
  }

  // Extracted markdown (as-is for now; future: LLM markdownification)
  writeFileSync(join(packetDir, 'extracted.md'), extracted, 'utf-8');

  const manifest = {
    sourceId,
    type: 'text' as const,
    title,
    captured: new Date().toISOString(),
    status: 'pending' as const,
    tokens,
    chunked: tokens > MAX_EXTRACTED_TOKENS,
  };
  writeJson(join(packetDir, 'manifest.json'), manifest);

  return { sourceId, packetDir };
}
