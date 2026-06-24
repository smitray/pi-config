/**
 * Pure markdown helpers used by web-fetch and docs-store.
 * No I/O, no dependencies — easy to unit-test.
 */

export function approxTokens(text: string): number {
  return Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.3);
}

/**
 * Split markdown into chunks of roughly `maxTokens` tokens, preserving
 * `## ` section boundaries when possible.
 */
export function splitIntoChunks(text: string, maxTokens: number): string[] {
  const sections = text.split(/\n(?=## )/);
  const chunks: string[] = [];
  let current = '';
  let currentTokens = 0;

  function flush(): void {
    if (current) {
      chunks.push(current);
      current = '';
      currentTokens = 0;
    }
  }

  function appendPiece(piece: string): void {
    const pieceTokens = approxTokens(piece);
    if (pieceTokens > maxTokens) {
      flush();
      // ponytail: word-budget split, naive boundary at exact word count.
      // Upgrade to sentence-aware if chunks cut mid-sentence too often.
      const words = piece.trim().split(/\s+/).filter(Boolean);
      const wordsPerChunk = Math.max(1, Math.floor(maxTokens / 1.3));
      for (let i = 0; i < words.length; i += wordsPerChunk) {
        chunks.push(words.slice(i, i + wordsPerChunk).join(' '));
      }
      return;
    }
    if (currentTokens + pieceTokens > maxTokens) {
      flush();
    }
    current += (current ? '\n' : '') + piece;
    currentTokens += pieceTokens;
  }

  for (const section of sections) {
    const sectionTokens = approxTokens(section);
    if (sectionTokens <= maxTokens) {
      appendPiece(section);
      continue;
    }
    const paragraphs = section.split(/\n\n+/);
    for (const para of paragraphs) appendPiece(para);
  }

  flush();
  return chunks;
}

export function extractLinks(markdown: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const seen = new Set<string>();
  const links: string[] = [];
  const regex = /\[([^\]]*)\]\(([^)\s]+)\)/g;
  let match: RegExpExecArray | null = regex.exec(markdown);
  while (match !== null) {
    try {
      const resolved = new URL(match[2], baseUrl).href;
      const url = new URL(resolved);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        match = regex.exec(markdown);
        continue;
      }
      url.hash = '';
      const clean = url.href;
      if (url.hostname !== base.hostname) {
        match = regex.exec(markdown);
        continue;
      }
      if (!seen.has(clean)) {
        seen.add(clean);
        links.push(clean);
      }
    } catch {
      // ignore malformed URLs
    }
    match = regex.exec(markdown);
  }
  return links;
}

export function extractTitle(markdown: string): string {
  const match = /^#\s+(.+)$/m.exec(markdown);
  return match ? match[1].trim() : '';
}
