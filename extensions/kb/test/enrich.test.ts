import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findPageByTitle, mergeObservationIntoPage } from '../lib/enrich';
import type { VaultPaths } from '../lib/vault';

const TEST_DIR = join(import.meta.dirname, '.tmp-enrich-test');

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
});

afterEach(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
});

describe('findPageByTitle', () => {
  it('finds page by exact slug match', () => {
    const paths = makePaths();
    mkdirSync(join(paths.wiki, 'sources'), { recursive: true });
    writeFileSync(
      join(paths.wiki, 'sources', 'auth-strategy.md'),
      '---\ntitle: Auth Strategy\n---\nContent'
    );

    const found = findPageByTitle(paths, 'Auth Strategy');
    expect(found).toContain('auth-strategy.md');
  });

  it('finds page by partial slug match', () => {
    const paths = makePaths();
    mkdirSync(join(paths.wiki), { recursive: true });
    writeFileSync(
      join(paths.wiki, 'jwt-auth-pattern.md'),
      '---\ntitle: JWT Auth Pattern\n---\nContent'
    );

    const found = findPageByTitle(paths, 'JWT Auth');
    expect(found).toContain('jwt-auth-pattern.md');
  });

  it('returns null for non-existent page', () => {
    const paths = makePaths();
    mkdirSync(paths.wiki, { recursive: true });

    const found = findPageByTitle(paths, 'Non Existent');
    expect(found).toBeNull();
  });
});

describe('mergeObservationIntoPage', () => {
  it('merges content into existing page', () => {
    const paths = makePaths();
    mkdirSync(join(paths.wiki, 'sources'), { recursive: true });
    writeFileSync(
      join(paths.wiki, 'sources', 'auth-strategy.md'),
      '---\ntitle: Auth Strategy\nupdated: 2026-06-28\n---\n\n# Auth Strategy\n\nExisting content.'
    );

    const result = mergeObservationIntoPage(
      paths,
      'Auth Strategy',
      'JWT Refresh Tokens',
      'Use short-lived access tokens with long-lived refresh tokens.',
      'Discussed during API review'
    );

    expect(result.merged).toBe(true);
    expect(result.pagePath).toContain('auth-strategy.md');

    const content = readFileSync(result.pagePath, 'utf-8');
    expect(content).toContain('## JWT Refresh Tokens');
    expect(content).toContain('Use short-lived access tokens');
    expect(content).toContain('Discussed during API review');
    expect(content).toContain('Existing content.');
  });

  it('updates frontmatter date', () => {
    const paths = makePaths();
    mkdirSync(join(paths.wiki, 'sources'), { recursive: true });
    writeFileSync(
      join(paths.wiki, 'sources', 'test-page.md'),
      '---\ntitle: Test Page\nupdated: 2026-01-01\n---\n\nContent'
    );

    const result = mergeObservationIntoPage(paths, 'Test Page', 'New Section', 'New content');

    expect(result.merged).toBe(true);

    const content = readFileSync(result.pagePath, 'utf-8');
    // Should have today's date, not 2026-01-01
    expect(content).not.toContain('updated: 2026-01-01');
  });

  it('returns error for non-existent page', () => {
    const paths = makePaths();
    mkdirSync(paths.wiki, { recursive: true });

    const result = mergeObservationIntoPage(paths, 'Non Existent', 'Section', 'Content');

    expect(result.merged).toBe(false);
    expect(result.message).toContain('not found');
  });
});
