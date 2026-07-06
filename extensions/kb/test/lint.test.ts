import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatLintReport, lintWiki } from '../lib/lint';
import type { VaultPaths } from '../lib/vault';

const TEST_DIR = join(import.meta.dirname, '.tmp-lint-test');

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

function setupVault(): VaultPaths {
  const paths = makePaths();
  mkdirSync(paths.wiki, { recursive: true });
  mkdirSync(paths.meta, { recursive: true });
  return paths;
}

beforeEach(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
});

describe('lintWiki', () => {
  it('returns no issues for empty wiki', () => {
    const paths = setupVault();
    const report = lintWiki(paths);

    expect(report.issues).toEqual([]);
    expect(report.summary.total).toBe(0);
  });

  it('detects orphan pages', () => {
    const paths = setupVault();
    writeFileSync(join(paths.wiki, 'orphan.md'), '---\ntitle: Orphan\n---\nContent');
    writeFileSync(
      join(paths.wiki, 'linked.md'),
      '---\ntitle: Linked\n---\nSee [[home]] for details.'
    );

    const report = lintWiki(paths);

    const orphans = report.issues.filter((i) => i.type === 'orphan');
    expect(orphans.length).toBeGreaterThan(0);
    expect(report.summary.orphans).toBeGreaterThan(0);
  });

  it('detects broken wikilinks', () => {
    const paths = setupVault();
    writeFileSync(
      join(paths.wiki, 'page.md'),
      '---\ntitle: Page\n---\nSee [[nonexistent]] for details.'
    );

    const report = lintWiki(paths);

    const broken = report.issues.filter((i) => i.type === 'broken_link');
    expect(broken).toHaveLength(1);
    expect(broken[0].page).toBe('page');
    expect(broken[0].message).toContain('[[nonexistent]]');
    expect(report.summary.brokenLinks).toBe(1);
  });

  it('detects empty pages', () => {
    const paths = setupVault();
    writeFileSync(join(paths.wiki, 'empty.md'), '---\ntitle: Empty\n---\n');
    writeFileSync(join(paths.wiki, 'full.md'), '---\ntitle: Full\n---\nThis page has content.');

    const report = lintWiki(paths);

    const empty = report.issues.filter((i) => i.type === 'empty');
    expect(empty).toHaveLength(1);
    expect(empty[0].page).toBe('empty');
    expect(report.summary.empty).toBe(1);
  });

  it('detects stale pages', () => {
    const paths = setupVault();
    writeFileSync(join(paths.wiki, 'stale.md'), '---\ntitle: Stale\n---\nOld content.');

    // Use a very small staleDays to make the page stale
    // The page was just created, so 0 days means it's stale
    const report = lintWiki(paths, -1);

    const stale = report.issues.filter((i) => i.type === 'stale');
    expect(stale).toHaveLength(1);
    expect(stale[0].page).toBe('stale');
    expect(report.summary.stale).toBe(1);
  });

  it('counts warnings and info separately', () => {
    const paths = setupVault();
    // Broken link = warning
    writeFileSync(join(paths.wiki, 'bad-link.md'), '---\ntitle: Bad Link\n---\nSee [[missing]].');
    // Empty page = info
    writeFileSync(join(paths.wiki, 'empty.md'), '---\ntitle: Empty\n---\n');

    const report = lintWiki(paths);

    expect(report.summary.warnings).toBeGreaterThan(0);
    expect(report.summary.info).toBeGreaterThan(0);
  });
});

describe('formatLintReport', () => {
  it('formats clean report', () => {
    const report = {
      issues: [],
      summary: {
        total: 0,
        warnings: 0,
        info: 0,
        orphans: 0,
        brokenLinks: 0,
        missingPages: 0,
        stale: 0,
        empty: 0,
      },
    };
    const formatted = formatLintReport(report);

    expect(formatted).toContain('Lint passed');
  });

  it('formats report with issues', () => {
    const report = {
      issues: [
        {
          type: 'broken_link' as const,
          severity: 'warning' as const,
          page: 'test',
          message: 'Broken link [[foo]]',
        },
        {
          type: 'orphan' as const,
          severity: 'info' as const,
          page: 'orphan',
          message: 'No inbound links',
        },
      ],
      summary: {
        total: 2,
        warnings: 1,
        info: 1,
        orphans: 1,
        brokenLinks: 1,
        missingPages: 0,
        stale: 0,
        empty: 0,
      },
    };
    const formatted = formatLintReport(report);

    expect(formatted).toContain('2 issue(s)');
    expect(formatted).toContain('Broken Wikilinks');
    expect(formatted).toContain('Orphan Pages');
  });
});
