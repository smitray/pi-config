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
  try {
    extracted = readFileSync(filePath, 'utf-8');
    // Wrap in markdown code fence if not already markdown
    const ext = basename(filePath).split('.').pop()?.toLowerCase() || '';
    if (!['md', 'txt'].includes(ext)) {
      extracted = `\`\`\`${ext}\n${extracted}\n\`\`\``;
    }
  } catch {
    extracted = `_Binary file: ${basename(filePath)}_`;
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

/**
 * Detect if text is HTML content.
 * ponytail: simple heuristic — look for common HTML tags.
 * Upgrade to proper parser if false positives become common.
 */
function isHtml(text: string): boolean {
  const htmlPatterns = [
    /<[a-z][\s>]/i, // Opening tags
    /<\//i, // Closing tags
    /<!DOCTYPE/i, // DOCTYPE
    /&[a-z]+;/i, // HTML entities
  ];
  return htmlPatterns.some((p) => p.test(text));
}

/**
 * Convert HTML to basic markdown.
 * ponytail: naive regex-based conversion. Good enough for simple HTML.
 * Upgrade to turndown or similar if complex HTML needs better handling.
 */
function htmlToMarkdown(html: string): string {
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n')
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n')
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    .replace(/<pre[^>]*>(.*?)<\/pre>/gis, '\n```\n$1\n```\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<[^>]+>/g, '') // Remove remaining tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines
    .trim();
}

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

  // Normalize HTML to markdown if detected
  let normalized = text;
  if (isHtml(text)) {
    normalized = htmlToMarkdown(text);
  }

  // Chunk large content
  const tokens = approxTokens(normalized);
  let extracted = normalized;
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
