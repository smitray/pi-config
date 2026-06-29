import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { approxTokens, splitIntoChunks } from './markdown'; // paragraph-based chunking (mature)

// ponytail: keep kb-packets simple — use proven paragraph splitter. markdown-it.ts available
// for future AST-based features (heading detection, etc.).

/**
 * KB source-packet shape written to `{kbRoot}/raw/sources/SRC-YYYY-MM-DD-NNN/`:
 *   original/url.txt    — the URL string (the "original" for url-typed captures)
 *   extracted.md        — markdown content from the crawler
 *   manifest.json       — { sourceId, type: 'url', title, url, captured, status, tokens, chunked }
 *
 * Source-packet shape matches the kb extension's captureFile/captureText output
 * (see extensions/kb/lib/capture.ts). Kept duplicated here to avoid a cross-extension
 * import — web-fetch-docs is a one-shot ingestion tool, not an extension-coupled module.
 * ponytail: ~60 lines, add when KB exposes a capture library API.
 */

export interface KbSourcePacket {
  sourceId: string;
  packetDir: string;
  url: string;
  title: string;
  skipped?: boolean;
}

interface ExistingPacket {
  sourceId: string;
  url?: string;
  manifestPath: string;
}

/**
 * Find the next available source ID for a given date by scanning existing packets.
 * Matches KB's `nextSourceId()` in lib/capture.ts: `SRC-{YYYY-MM-DD}-{NNN}`.
 */
function nextSourceId(rawSourcesDir: string, date: Date): string {
  const prefix = `SRC-${date.toISOString().slice(0, 10)}-`;
  let maxN = 0;
  if (existsSync(rawSourcesDir)) {
    for (const name of readdirSync(rawSourcesDir)) {
      const m = name.match(/^SRC-\d{4}-\d{2}-\d{2}-(\d{3})$/);
      if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
    }
  }
  return `${prefix}${String(maxN + 1).padStart(3, '0')}`;
}

/** Read existing packet manifests, return those with a url field (for dedup). */
function existingUrlPackets(rawSourcesDir: string): Map<string, ExistingPacket> {
  const out = new Map<string, ExistingPacket>();
  if (!existsSync(rawSourcesDir)) return out;
  for (const name of readdirSync(rawSourcesDir)) {
    if (!name.startsWith('SRC-')) continue;
    const manifestPath = join(rawSourcesDir, name, 'manifest.json');
    if (!existsSync(manifestPath)) continue;
    try {
      const m = JSON.parse(readFileSync(manifestPath, 'utf-8')) as { url?: string };
      if (m.url) out.set(m.url, { sourceId: name, url: m.url, manifestPath });
    } catch {
      // ignore malformed
    }
  }
  return out;
}

const MAX_TOKENS = 4000;

/**
 * Write each crawled page as a KB source packet under {kbRoot}/raw/sources/.
 * Pages whose URL already exists as a packet are skipped (idempotent re-crawl).
 */
export function writePagesAsKbPackets(
  pages: { url: string; title: string; markdown: string }[],
  kbRoot: string
): KbSourcePacket[] {
  const rawSourcesDir = join(kbRoot, 'raw', 'sources');
  const existing = existingUrlPackets(rawSourcesDir);
  const now = new Date();
  const packets: KbSourcePacket[] = [];
  // Track IDs allocated in this call so dedup applies within the batch too.
  const seenUrls = new Set<string>();

  for (const page of pages) {
    if (existing.has(page.url) || seenUrls.has(page.url)) {
      packets.push({
        sourceId: existing.get(page.url)?.sourceId ?? '',
        packetDir: join(rawSourcesDir, existing.get(page.url)?.sourceId ?? ''),
        url: page.url,
        title: page.title,
        skipped: true,
      });
      continue;
    }
    seenUrls.add(page.url);

    const sourceId = nextSourceId(rawSourcesDir, now);
    const packetDir = join(rawSourcesDir, sourceId);
    // Ponytail: mkdirSync with recursive:false throws EEXIST on duplicate,
    // surfacing race conditions between concurrent crawls.
    mkdirSync(packetDir, { recursive: false });
    mkdirSync(join(packetDir, 'original'), { recursive: false });

    writeFileSync(join(packetDir, 'original', 'url.txt'), page.url, 'utf-8');
    const tokens = approxTokens(page.markdown);
    // Match kb/lib/capture.ts: chunk content that exceeds MAX_TOKENS so each
    // section stays within agent-readable size. Re-uses web-access chunker.
    const extracted =
      tokens > MAX_TOKENS
        ? splitIntoChunks(page.markdown, MAX_TOKENS).join('\n\n---\n\n')
        : page.markdown;
    writeFileSync(join(packetDir, 'extracted.md'), extracted, 'utf-8');

    const manifest = {
      sourceId,
      type: 'url' as const,
      title: page.title || page.url,
      url: page.url,
      captured: now.toISOString(),
      status: 'pending' as const,
      tokens,
      chunked: tokens > MAX_TOKENS,
    };
    writeFileSync(join(packetDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

    packets.push({ sourceId, packetDir, url: page.url, title: page.title });
  }

  return packets;
}
