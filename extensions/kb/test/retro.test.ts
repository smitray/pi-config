import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatRetroResult, saveInsight } from '../lib/retro';
import type { VaultPaths } from '../lib/vault';

const TEST_DIR = join(import.meta.dirname, '.tmp-retro-test');

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
});

afterEach(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
});

describe('saveInsight', () => {
  it('creates insight file in wiki/sources/', () => {
    const paths = makePaths();
    mkdirSync(paths.wiki, { recursive: true });

    const result = saveInsight(paths, {
      title: 'JWT Auth Pattern',
      body: 'Use short-lived access tokens with long-lived refresh tokens.',
      category: 'decision',
    });

    expect(result.slug).toBe('jwt-auth-pattern');
    expect(existsSync(result.pagePath)).toBe(true);
  });

  it('writes correct frontmatter', () => {
    const paths = makePaths();
    mkdirSync(paths.wiki, { recursive: true });

    const result = saveInsight(paths, {
      title: 'Test Insight',
      body: 'Some content',
    });

    const content = readFileSync(result.pagePath, 'utf-8');
    expect(content).toContain('type: source');
    expect(content).toContain('status: insight');
    expect(content).toContain('title: "Test Insight"');
  });

  it('includes category when provided', () => {
    const paths = makePaths();
    mkdirSync(paths.wiki, { recursive: true });

    const result = saveInsight(paths, {
      title: 'Categorized Insight',
      body: 'Content with category',
      category: 'learning',
    });

    const content = readFileSync(result.pagePath, 'utf-8');
    expect(content).toContain('category: learning');
  });

  it('creates sources directory if it does not exist', () => {
    const paths = makePaths();
    mkdirSync(paths.wiki, { recursive: true });

    saveInsight(paths, {
      title: 'First Insight',
      body: 'Content',
    });

    expect(existsSync(join(paths.wiki, 'sources'))).toBe(true);
  });
});

describe('formatRetroResult', () => {
  it('formats result with title', () => {
    const result = {
      slug: 'test-insight',
      pagePath: '/path/to/file.md',
    };

    const formatted = formatRetroResult(result, 'Test Title');

    expect(formatted).toContain('✅ Insight saved');
    expect(formatted).toContain('test-insight');
    expect(formatted).toContain('Test Title');
    expect(formatted).toContain('kb_recall_*');
  });
});
