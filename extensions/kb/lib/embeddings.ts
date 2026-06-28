import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getEmbeddingsConfig, getModelConfig } from './models';
import type { VaultPaths } from './vault';

interface EmbeddingEntry {
  pagePath: string;
  embedding: number[];
  updatedAt: string;
}

interface EmbeddingsStore {
  model: string;
  dimensions: number;
  entries: Record<string, EmbeddingEntry>;
}

// ponytail: lazy load store, write-through on changes
let store: EmbeddingsStore | null = null;

function getStorePath(paths: VaultPaths): string {
  const config = getEmbeddingsConfig();
  return join(paths.dotKb, config.storePath);
}

/**
 * Load embeddings store from disk.
 */
export function loadEmbeddings(paths: VaultPaths): EmbeddingsStore {
  if (store) return store;

  const storePath = getStorePath(paths);
  if (!existsSync(storePath)) {
    store = { model: '', dimensions: 0, entries: {} };
    return store;
  }

  try {
    const raw = readFileSync(storePath, 'utf-8');
    store = JSON.parse(raw) as EmbeddingsStore;
    return store;
  } catch {
    store = { model: '', dimensions: 0, entries: {} };
    return store;
  }
}

/**
 * Save embeddings store to disk.
 */
function saveEmbeddings(paths: VaultPaths): void {
  if (!store) return;
  const storePath = getStorePath(paths);
  mkdirSync(dirname(storePath), { recursive: true });
  writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf-8');
}

/**
 * Store embedding for a page.
 */
export function storeEmbedding(paths: VaultPaths, pagePath: string, embedding: number[]): void {
  const s = loadEmbeddings(paths);
  const config = getModelConfig('embedding');

  // Update model info if empty
  if (!s.model) {
    s.model = config.id;
    s.dimensions = config.dimensions ?? embedding.length;
  }

  s.entries[pagePath] = {
    pagePath,
    embedding,
    updatedAt: new Date().toISOString(),
  };

  saveEmbeddings(paths);
}

/**
 * Get embedding for a single page.
 */
export function getEmbedding(paths: VaultPaths, pagePath: string): number[] | null {
  const s = loadEmbeddings(paths);
  return s.entries[pagePath]?.embedding ?? null;
}

/**
 * Remove embedding for a page.
 */
export function removeEmbedding(paths: VaultPaths, pagePath: string): void {
  const s = loadEmbeddings(paths);
  delete s.entries[pagePath];
  saveEmbeddings(paths);
}

/**
 * Clear embeddings cache (for testing).
 */
export function clearEmbeddingsCache(): void {
  store = null;
}

/**
 * Check if embeddings need re-generation (model changed).
 * Returns false if no embeddings exist (nothing to re-generate).
 */
export function needsReEmbedding(paths: VaultPaths): boolean {
  const s = loadEmbeddings(paths);
  // No embeddings = no re-embedding needed
  if (Object.keys(s.entries).length === 0) return false;
  const config = getModelConfig('embedding');
  return s.model !== config.id;
}

/**
 * Get all embedded page paths.
 */
export function getEmbeddedPages(paths: VaultPaths): string[] {
  const s = loadEmbeddings(paths);
  return Object.keys(s.entries);
}
