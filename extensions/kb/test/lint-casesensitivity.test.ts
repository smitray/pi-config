import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { lintWiki } from '../lib/lint';
import type { VaultPaths } from '../lib/vault';

const TEST_DIR = join(import.meta.dirname, '.tmp-lint-casesens');

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
  mkdirSync(join(TEST_DIR, 'wiki', 'plans'), { recursive: true });
  mkdirSync(join(TEST_DIR, 'wiki', 'todos'), { recursive: true });
});

afterEach(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
});

describe('lintWiki — case-sensitive wikilinks (regression)', () => {
  it('does not flag [[plans/plan-PLAN-003]] when the page exists', () => {
    const paths = makePaths();
    writeFileSync(
      join(paths.wiki, 'plans', 'plan-PLAN-003.md'),
      '---\ntitle: Test Plan\n---\nContent here.'
    );
    writeFileSync(
      join(paths.wiki, 'source.md'),
      '---\ntitle: Source\n---\nSee [[plans/plan-PLAN-003]] for details.'
    );

    const report = lintWiki(paths);
    const broken = report.issues.filter((i) => i.type === 'broken_link');
    expect(broken).toHaveLength(0);
  });

  it('does not flag [[todos/todo-TODO-007]] when the page exists', () => {
    const paths = makePaths();
    writeFileSync(
      join(paths.wiki, 'todos', 'todo-TODO-007.md'),
      '---\ntitle: Test Todo\n---\nContent.'
    );
    writeFileSync(
      join(paths.wiki, 'source.md'),
      '---\ntitle: Source\n---\nRefs [[todos/todo-TODO-007]].'
    );

    const report = lintWiki(paths);
    const broken = report.issues.filter((i) => i.type === 'broken_link');
    expect(broken).toHaveLength(0);
  });

  it('still flags truly broken links', () => {
    const paths = makePaths();
    writeFileSync(
      join(paths.wiki, 'source.md'),
      '---\ntitle: Source\n---\nRefs [[plans/plan-NONEXISTENT]].'
    );

    const report = lintWiki(paths);
    const broken = report.issues.filter((i) => i.type === 'broken_link');
    expect(broken.length).toBeGreaterThan(0);
  });
});
