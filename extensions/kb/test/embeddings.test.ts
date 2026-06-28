import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearEmbeddingsCache,
  getEmbeddedPages,
  getEmbedding,
  needsReEmbedding,
  removeEmbedding,
  storeEmbedding,
} from '../lib/embeddings';
import type { VaultPaths } from '../lib/vault';

const TEST_DIR = join(import.meta.dirname, '.tmp-embeddings-test');

function makePaths(): VaultPaths {
  return {
    dotKb: TEST_DIR,
    raw: join(TEST_DIR, 'raw'),
    wiki: join(TEST_DIR, 'wiki'),
    meta: join(TEST_DIR, 'meta'),
    templates: join(TEST_DIR, 'templates', 'pages'),
  };
}

beforeEach(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  mkdirSync(TEST_DIR, { recursive: true });
  clearEmbeddingsCache();
});

afterEach(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  clearEmbeddingsCache();
});

describe('storeEmbedding', () => {
  it('stores embedding and creates file', () => {
    const paths = makePaths();
    const embedding = [0.1, 0.2, 0.3];

    storeEmbedding(paths, 'sources/test.md', embedding);

    const stored = getEmbedding(paths, 'sources/test.md');
    expect(stored).toEqual(embedding);
  });

  it('overwrites existing embedding', () => {
    const paths = makePaths();

    storeEmbedding(paths, 'test.md', [0.1]);
    storeEmbedding(paths, 'test.md', [0.9]);

    const stored = getEmbedding(paths, 'test.md');
    expect(stored).toEqual([0.9]);
  });
});

describe('getEmbedding', () => {
  it('returns null for missing page', () => {
    const paths = makePaths();
    expect(getEmbedding(paths, 'missing.md')).toBeNull();
  });
});

describe('removeEmbedding', () => {
  it('removes stored embedding', () => {
    const paths = makePaths();
    storeEmbedding(paths, 'test.md', [0.1]);
    removeEmbedding(paths, 'test.md');

    expect(getEmbedding(paths, 'test.md')).toBeNull();
  });
});

describe('getEmbeddedPages', () => {
  it('returns all embedded page paths', () => {
    const paths = makePaths();
    storeEmbedding(paths, 'a.md', [0.1]);
    storeEmbedding(paths, 'b.md', [0.2]);

    const pages = getEmbeddedPages(paths);
    expect(pages).toContain('a.md');
    expect(pages).toContain('b.md');
    expect(pages).toHaveLength(2);
  });
});

describe('needsReEmbedding', () => {
  it('returns false when no embeddings exist', () => {
    const paths = makePaths();
    expect(needsReEmbedding(paths)).toBe(false);
  });

  it('returns true when model changed', () => {
    const paths = makePaths();
    // Manually write store with different model
    mkdirSync(join(TEST_DIR, 'meta'), { recursive: true });
    const storeData = {
      model: 'old-model',
      dimensions: 1024,
      entries: { 'test.md': { pagePath: 'test.md', embedding: [0.1], updatedAt: '2026-01-01' } },
    };
    const fs = require('node:fs');
    fs.writeFileSync(join(TEST_DIR, 'meta', 'embeddings.json'), JSON.stringify(storeData));

    // Clear cache so it reads from disk
    clearEmbeddingsCache();

    expect(needsReEmbedding(paths)).toBe(true);
  });
});
