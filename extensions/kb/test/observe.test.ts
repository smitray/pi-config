import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatObservationResult, saveObservation } from '../lib/observe';
import type { VaultPaths } from '../lib/vault';

const TEST_DIR = join(import.meta.dirname, '.tmp-observe-test');

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

describe('saveObservation', () => {
  it('creates observation file in wiki/sources/', () => {
    const paths = makePaths();
    mkdirSync(paths.wiki, { recursive: true });

    const result = saveObservation(paths, {
      title: 'Auth Strategy Decision',
      content: 'Decided to use JWT with refresh tokens for the auth system.',
      relevance: 'high',
      tags: ['auth', 'jwt'],
    });

    expect(result.sourceId).toContain('OBS-');
    expect(result.sourceId).toContain('auth-strategy-decision');
    expect(existsSync(result.pagePath)).toBe(true);
  });

  it('writes correct frontmatter', () => {
    const paths = makePaths();
    mkdirSync(paths.wiki, { recursive: true });

    const result = saveObservation(paths, {
      title: 'Test Observation',
      content: 'Some content',
      relevance: 'medium',
    });

    const content = readFileSync(result.pagePath, 'utf-8');
    expect(content).toContain('type: source');
    expect(content).toContain('status: observation');
    expect(content).toContain('relevance: medium');
    expect(content).toContain('title: "Test Observation"');
  });

  it('includes tags in frontmatter', () => {
    const paths = makePaths();
    mkdirSync(paths.wiki, { recursive: true });

    const result = saveObservation(paths, {
      title: 'Tagged Observation',
      content: 'Content with tags',
      relevance: 'low',
      tags: ['react', 'hooks'],
    });

    const content = readFileSync(result.pagePath, 'utf-8');
    expect(content).toContain('tags: ["react", "hooks"]');
  });

  it('includes source context when provided', () => {
    const paths = makePaths();
    mkdirSync(paths.wiki, { recursive: true });

    const result = saveObservation(paths, {
      title: 'Context Observation',
      content: 'Observation content',
      relevance: 'high',
      sourceContext: 'Was discussing auth patterns when this came up.',
    });

    const content = readFileSync(result.pagePath, 'utf-8');
    expect(content).toContain('## Context');
    expect(content).toContain('Was discussing auth patterns when this came up.');
  });

  it('creates sources directory if it does not exist', () => {
    const paths = makePaths();
    mkdirSync(paths.wiki, { recursive: true });

    saveObservation(paths, {
      title: 'First Observation',
      content: 'Content',
      relevance: 'low',
    });

    expect(existsSync(join(paths.wiki, 'sources'))).toBe(true);
  });
});

describe('formatObservationResult', () => {
  it('formats result with title', () => {
    const result = {
      sourceId: 'OBS-2026-06-29-test',
      pagePath: '/path/to/file.md',
    };

    const formatted = formatObservationResult(result, 'Test Title');

    expect(formatted).toContain('✅ Observation saved');
    expect(formatted).toContain('OBS-2026-06-29-test');
    expect(formatted).toContain('Test Title');
    expect(formatted).toContain('kb_recall_*');
  });
});
