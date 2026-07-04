import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { captureFile, captureText } from '../lib/capture';
import { getUningestedSources, markSourceIngested } from '../lib/ingest';
import { extractWikilinks, parseFrontmatter, rebuildMetadata } from '../lib/metadata';
import { formatRecallResults, searchByTag, searchWiki, tokenize } from '../lib/recall';
import { buildPage, loadTemplate, writeDefaultTemplates } from '../lib/templates';
import {
  ensureVaultStructure,
  fmtDate,
  getVaultPaths,
  resolveVaultContext,
  slugify,
} from '../lib/vault';

// ─── Test utilities ──────────────────────────────────────────────

const CONCEPT = 'concept';

let tmpRoot: string;

function setupVault(): ReturnType<typeof getVaultPaths> {
  tmpRoot = mkdtempSync(join(tmpdir(), 'kb-test-'));
  process.env.KB_HOME = tmpRoot;
  const paths = getVaultPaths(tmpRoot);
  ensureVaultStructure(paths);
  writeDefaultTemplates(paths);
  return paths;
}

function cleanup() {
  if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
  delete process.env.KB_HOME;
}

// ─── vault ───────────────────────────────────────────────────────

describe('vault context', () => {
  it('returns personal mode outside a project', () => {
    const ctx = resolveVaultContext(tmpdir());
    expect(ctx.mode).toBe('personal');
    expect(ctx.isProject).toBe(false);
  });

  it('detects project via .kb/config.json', () => {
    setupVault();
    writeFileSync(join(tmpRoot, 'package.json'), '{}');
    expect(resolveVaultContext(tmpRoot).mode).toBe('project');
    cleanup();
  });

  it('KB_MODE env var overrides vault mode', () => {
    process.env.KB_MODE = 'project';
    expect(resolveVaultContext(tmpdir()).mode).toBe('project');
    delete process.env.KB_MODE;
  });
});

describe('vault structure', () => {
  it('ensureVaultStructure creates all directories', () => {
    const paths = setupVault();
    expect(existsSync(paths.rawSources)).toBe(true);
    expect(existsSync(paths.wiki)).toBe(true);
    expect(existsSync(paths.meta)).toBe(true);
    expect(existsSync(paths.templates)).toBe(true);
    cleanup();
  });

  it('fmtDate returns ISO date (YYYY-MM-DD)', () => {
    expect(fmtDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('slugify converts text to file-safe slug', () => {
    expect(slugify('Hello World')).toBe('hello-world');
    expect(slugify('C++ & Rust!!!')).toBe('c-rust');
  });
});

// ─── templates ───────────────────────────────────────────────────

describe('template write', () => {
  it('creates all 8 template files (project mode)', () => {
    const paths = setupVault();
    for (const t of [
      CONCEPT,
      'entity',
      'synthesis',
      'analysis',
      'source',
      'meeting',
      'diary',
      'artifact',
    ]) {
      expect(existsSync(join(paths.templates, `${t}.md`))).toBe(true);
    }
    cleanup();
  });

  it('skips artifact in personal mode', () => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'kb-test-personal-'));
    process.env.KB_HOME = tmpRoot;
    const paths = getVaultPaths(tmpRoot);
    ensureVaultStructure(paths);
    writeDefaultTemplates(paths, 'personal');
    expect(existsSync(join(paths.templates, 'artifact.md'))).toBe(false);
    expect(existsSync(join(paths.templates, 'concept.md'))).toBe(true);
    rmSync(tmpRoot, { recursive: true, force: true });
    delete process.env.KB_HOME;
  });
});

describe('template load', () => {
  it('returns disk template when it exists', () => {
    const paths = setupVault();
    const tmpl = loadTemplate(CONCEPT, paths);
    expect(tmpl).toContain('---');
    expect(tmpl).toContain('type: concept');
    cleanup();
  });

  it('falls back to builtin when file missing', () => {
    const paths = setupVault();
    unlinkSync(join(paths.templates, 'concept.md'));
    const tmpl = loadTemplate(CONCEPT, paths);
    expect(tmpl).toContain('type: concept');
    cleanup();
  });

  it('buildPage enforces template frontmatter', () => {
    const paths = setupVault();
    const { content, filename } = buildPage('synthesis', 'Test Synthesis', paths);
    expect(content).toContain('type: synthesis');
    expect(content).toContain('title: "Test Synthesis"');
    expect(content).toContain('created:');
    expect(filename).toBe('test-synthesis.md');
    cleanup();
  });
});

// ─── helpers ────────────────────────────────────────────────────

function createPage(
  paths: ReturnType<typeof getVaultPaths>,
  type: string,
  name: string,
  content: string
) {
  const dir = join(paths.wiki, `${type}s`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.md`), content);
}

// ─── frontmatter ────────────────────────────────────────────────

describe('frontmatter', () => {
  it('parseFrontmatter extracts all fields', () => {
    const md =
      '---\ntype: concept\ntitle: My Page\ntags: [react, typescript]\nconfidence: high\n---\nBody.';
    const fm = parseFrontmatter(md);
    expect(fm.type).toBe(CONCEPT);
    expect(fm.title).toBe('My Page');
    expect(fm.tags).toEqual(['react', 'typescript']);
    expect(fm.confidence).toBe('high');
  });

  it('returns empty object for no frontmatter', () => {
    expect(Object.keys(parseFrontmatter('Just markdown.')).length).toBe(0);
  });

  it('extractWikilinks finds all [[links]]', () => {
    expect(extractWikilinks('See [[React]] and [[TypeScript]]')).toEqual(['React', 'TypeScript']);
  });

  it('extractWikilinks returns empty for no links', () => {
    expect(extractWikilinks('No links here.')).toEqual([]);
  });
});

describe('rebuild', () => {
  it('rebuildMetadata creates registry and backlinks', () => {
    const paths = setupVault();
    createPage(
      paths,
      CONCEPT,
      'react-intro',
      [
        '---',
        'type: concept',
        'title: React Intro',
        'tags: [react]',
        '---',
        'See [[Vue Basics]] for comparison.',
      ].join('\n')
    );
    rebuildMetadata(paths);
    const reg = JSON.parse(readFileSync(join(paths.meta, 'registry.json'), 'utf-8'));
    expect(reg.find((e: { title: string }) => e.title === 'React Intro')).toBeDefined();
    cleanup();
  });
});

// ─── capture ─────────────────────────────────────────────────────

describe('capture', () => {
  it('captureText creates a source packet', () => {
    const paths = setupVault();
    const result = captureText('Hello world', 'Test Source', paths);
    expect(result.sourceId).toMatch(/^SRC-/);
    expect(existsSync(join(result.packetDir, 'manifest.json'))).toBe(true);
    expect(existsSync(join(result.packetDir, 'extracted.md'))).toBe(true);
    expect(existsSync(join(result.packetDir, 'original', 'content.txt'))).toBe(true);
    cleanup();
  });

  it('captureFile copies source to raw/', () => {
    const paths = setupVault();
    const srcFile = join(tmpRoot, 'test-file.ts');
    writeFileSync(srcFile, 'export const x = 1;');
    const result = captureFile(srcFile, 'Test File', paths);
    expect(result.sourceId).toMatch(/^SRC-/);
    expect(existsSync(join(result.packetDir, 'original', 'test-file.ts'))).toBe(true);
    cleanup();
  });

  it('captureFile marks non-md files with code fences', () => {
    const paths = setupVault();
    const srcFile = join(tmpRoot, 'config.json');
    writeFileSync(srcFile, '{"key": "value"}');
    const result = captureFile(srcFile, 'Config', paths);
    const extracted = readFileSync(join(result.packetDir, 'extracted.md'), 'utf-8');
    expect(extracted).toContain('```json');
    cleanup();
  });
});

// ─── ingest ──────────────────────────────────────────────────────

describe('ingest', () => {
  it('getUningestedSources returns pending sources', () => {
    const paths = setupVault();
    captureText('Sample text', 'Sample', paths);
    const sources = getUningestedSources(paths);
    expect(sources.length).toBeGreaterThanOrEqual(1);
    expect(sources[0].status).toBe('pending');
    expect(sources[0].title).toBe('Sample');
    cleanup();
  });

  it('markSourceIngested sets status to ingested', () => {
    const paths = setupVault();
    const { sourceId } = captureText('Data', 'My Data', paths);
    const ok = markSourceIngested(sourceId, paths);
    expect(ok).toBe(true);
    const pending = getUningestedSources(paths);
    expect(pending.length).toBe(0);
    cleanup();
  });

  it('markSourceIngested returns false for missing source', () => {
    const paths = setupVault();
    expect(markSourceIngested('SRC-9999-99-999', paths)).toBe(false);
    cleanup();
  });
});

// ─── search ──────────────────────────────────────────────────────

describe('tokenize', () => {
  it('splits into lowercase terms', () => {
    expect(tokenize('React TypeScript')).toEqual(['react', 'typescript']);
    expect(tokenize('  multi   space  ')).toEqual(['multi', 'space']);
  });
});

describe('searchWiki', () => {
  it('returns empty for empty vault', () => {
    const paths = setupVault();
    rebuildMetadata(paths);
    expect(searchWiki(paths, paths, 'anything', 'context', 5).length).toBe(0);
    cleanup();
  });

  it('ranks results in context mode', () => {
    const paths = setupVault();
    createPage(
      paths,
      CONCEPT,
      'react-hooks',
      '---\ntype: concept\ntitle: React Hooks\ntags: [react]\n---\nContent.'
    );
    createPage(
      paths,
      CONCEPT,
      'vue-composables',
      '---\ntype: concept\ntitle: Vue Composables\ntags: [vue]\n---\nContent.'
    );
    rebuildMetadata(paths);
    const r = searchWiki(paths, paths, 'react', 'context', 5);
    expect(r.find((x) => x.id.includes('react'))?.score).toBeGreaterThan(0);
    cleanup();
  });
});

describe('formatRecallResults', () => {
  it('formats results as markdown', () => {
    const f = formatRecallResults([
      {
        id: 'c/r',
        title: 'React',
        type: CONCEPT,
        path: 'c/r.md',
        tags: ['react'],
        stage: 'production',
        score: 10,
        vault: 'project' as const,
      },
    ]);
    expect(f).toContain('React');
    expect(f).toContain('📁 project');
  });

  it('returns empty for no results', () => {
    expect(formatRecallResults([])).toBe('');
  });
});

describe('searchByTag', () => {
  it('filters by tag', () => {
    const paths = setupVault();
    createPage(paths, CONCEPT, 'a', '---\ntype: concept\ntitle: A\ntags: [x]\n---\nC.');
    createPage(paths, CONCEPT, 'b', '---\ntype: concept\ntitle: B\ntags: [y]\n---\nC.');
    rebuildMetadata(paths);
    expect(searchByTag(paths, paths, { tag: 'x' }).length).toBe(1);
    cleanup();
  });

  it('filters by type', () => {
    const paths = setupVault();
    createPage(paths, CONCEPT, 'a', '---\ntype: concept\ntitle: A\ntags: []\n---\nC.');
    createPage(paths, 'entity', 'fastapi', '---\ntype: entity\ntitle: FastAPI\ntags: []\n---\nC.');
    rebuildMetadata(paths);
    expect(searchByTag(paths, paths, { type: 'entity' })[0].title).toBe('FastAPI');
    cleanup();
  });

  it('filters by stage', () => {
    const paths = setupVault();
    createPage(
      paths,
      CONCEPT,
      'draft',
      '---\ntype: concept\ntitle: Draft\ntags: []\nstage: draft\n---\nC.'
    );
    createPage(
      paths,
      CONCEPT,
      'prod',
      '---\ntype: concept\ntitle: Prod\ntags: []\nstage: production\n---\nC.'
    );
    rebuildMetadata(paths);
    expect(searchByTag(paths, paths, { stage: 'production' }).length).toBe(1);
    cleanup();
  });

  it('returns empty for no filters', () => {
    const paths = setupVault();
    expect(searchByTag(paths, paths, {}).length).toBe(0);
    cleanup();
  });
});

// ─── extension ───────────────────────────────────────────────────

describe('kb extension', () => {
  it('exports a default function', async () => {
    const mod = await import('../index.ts');
    expect(typeof mod.default).toBe('function');
  });
});
