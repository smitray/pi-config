import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AccessConfig } from './config';
import { approxTokens, splitIntoChunks } from './markdown';

export interface DocsPage {
  url: string;
  title: string;
  tokens: number;
  file: string;
}

export interface DocsManifest {
  label: string;
  baseUrl: string;
  crawledAt: number;
  depth: number;
  pages: DocsPage[];
}

export interface DocsChunk {
  sourceUrl: string;
  title: string;
  content: string;
  tokens: number;
}

// ponytail: label used as-is, no sanitization. Local single-user trust boundary.
export function docsRoot(config: AccessConfig): string {
  return join(config.downloadDir, 'docs');
}

export function docsDir(config: AccessConfig, label: string): string {
  return join(docsRoot(config), label);
}

export function listLabels(config: AccessConfig): string[] {
  const root = docsRoot(config);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

export function loadManifest(config: AccessConfig, label: string): DocsManifest | null {
  const path = join(docsDir(config, label), 'manifest.json');
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as DocsManifest;
  } catch {
    return null;
  }
}

export function saveManifest(config: AccessConfig, manifest: DocsManifest): void {
  const dir = docsDir(config, manifest.label);
  mkdirSync(join(dir, 'pages'), { recursive: true });
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

export function savePage(
  config: AccessConfig,
  label: string,
  filename: string,
  content: string
): void {
  const dir = join(docsDir(config, label), 'pages');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), content);
}

export function readPage(config: AccessConfig, label: string, filename: string): string {
  return readFileSync(join(docsDir(config, label), 'pages', filename), 'utf8');
}

export function deleteDocs(config: AccessConfig, label: string): void {
  rmSync(docsDir(config, label), { recursive: true, force: true });
}

export function chunkPages(
  manifest: DocsManifest,
  config: AccessConfig,
  maxTokens?: number
): DocsChunk[] {
  const limit = maxTokens ?? config.chunkTokens;
  const chunks: DocsChunk[] = [];
  for (const page of manifest.pages) {
    const md = readPage(config, manifest.label, page.file);
    const parts = splitIntoChunks(md, limit);
    for (const part of parts) {
      chunks.push({
        sourceUrl: page.url,
        title: page.title,
        content: part,
        tokens: approxTokens(part),
      });
    }
  }
  return chunks;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

/**
 * TF-IDF search over chunks. Ponytail choice: no embedding service, exact-term
 * ranking. Good for technical docs where terms matter. Upgrade to a cross-encoder
 * rerank when precision matters more than zero infra.
 */
export function searchDocs(
  query: string,
  chunks: DocsChunk[],
  topK: number
): Array<DocsChunk & { score: number }> {
  const terms = Array.from(new Set(tokenize(query)));
  if (terms.length === 0 || chunks.length === 0) {
    return chunks.slice(0, topK).map((c) => ({ ...c, score: 0 }));
  }

  const N = chunks.length;
  const df = new Map<string, number>();
  for (const chunk of chunks) {
    const unique = new Set(tokenize(chunk.content));
    for (const term of terms) {
      if (unique.has(term)) df.set(term, (df.get(term) || 0) + 1);
    }
  }

  const scored = chunks.map((chunk) => {
    const chunkTokens = tokenize(chunk.content);
    if (chunkTokens.length === 0) return { ...chunk, score: 0 };
    const tf = new Map<string, number>();
    for (const t of chunkTokens) tf.set(t, (tf.get(t) || 0) + 1);
    let score = 0;
    for (const term of terms) {
      const freq = tf.get(term) || 0;
      if (freq === 0) continue;
      const docFreq = df.get(term) || 0;
      const idf = Math.log(1 + N / (1 + docFreq));
      score += freq * idf;
    }
    return { ...chunk, score: score / Math.sqrt(chunkTokens.length) };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, topK);
}
