import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearEmbeddingsCache,
  cosineSearch,
  cosineSimilarity,
  getEmbeddedPages,
  getEmbedding,
  hybridSearch,
  needsReEmbedding,
  removeEmbedding,
  storeEmbedding,
} from '../lib/embeddings';
import type { VaultPaths } from '../lib/vault';

const TEST_DIR = join(import.meta.dirname, '.tmp-embeddings-test');

function makePaths(): VaultPaths {
  return {
    root: TEST_DIR,
    dotKb: TEST_DIR,
    raw: join(TEST_DIR, 'raw'),
    rawSources: join(TEST_DIR, 'raw', 'sources'),
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

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBe(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBe(-1);
  });

  it('returns 0 for different lengths', () => {
    expect(cosineSimilarity([1, 0], [1, 0, 0])).toBe(0);
  });
});

describe('cosineSearch', () => {
  it('returns ranked results', () => {
    const paths = makePaths();
    storeEmbedding(paths, 'a.md', [1, 0, 0]);
    storeEmbedding(paths, 'b.md', [0, 1, 0]);
    storeEmbedding(paths, 'c.md', [0.7, 0.7, 0]);

    const results = cosineSearch(paths, [1, 0, 0], 2);
    expect(results).toHaveLength(2);
    expect(results[0].pagePath).toBe('a.md');
    expect(results[0].score).toBeCloseTo(1, 5);
  });
});

describe('hybridSearch', () => {
  it('blends lexical and semantic scores', () => {
    const paths = makePaths();
    storeEmbedding(paths, 'a.md', [1, 0, 0]);
    storeEmbedding(paths, 'b.md', [0, 1, 0]);

    const lexicalResults = [
      { pagePath: 'a.md', score: 0.5 },
      { pagePath: 'b.md', score: 0.8 },
    ];

    const results = hybridSearch(paths, 'test', [1, 0, 0], lexicalResults, 2, 0.3);
    expect(results).toHaveLength(2);
    // b.md has higher lexical but a.md has higher semantic
    // With weight 0.3 lexical, semantic dominates
    expect(results[0].pagePath).toBe('a.md');
  });

  it('falls back to lexical-only when no embedding', () => {
    const paths = makePaths();
    const lexicalResults = [
      { pagePath: 'a.md', score: 0.5 },
      { pagePath: 'b.md', score: 0.8 },
    ];

    const results = hybridSearch(paths, 'test', null, lexicalResults, 2);
    expect(results).toHaveLength(2);
    expect(results[0].pagePath).toBe('b.md');
  });
});
