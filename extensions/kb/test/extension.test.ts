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

describe('vault resolution', () => {
  it('resolveVaultContext returns personal mode outside a project', () => {
    const ctx = resolveVaultContext(tmpdir());
    expect(ctx.mode).toBe('personal');
    expect(ctx.isProject).toBe(false);
  });

  it('resolveVaultContext detects project via .kb/config.json', () => {
    setupVault();
    // Write project hint to make it detect as project
    writeFileSync(join(tmpRoot, 'package.json'), '{}');
    const ctx = resolveVaultContext(tmpRoot);
    expect(ctx.mode).toBe('project');
    cleanup();
  });

  it('KB_MODE env var overrides vault mode', () => {
    process.env.KB_MODE = 'project';
    const ctx = resolveVaultContext(tmpdir());
    expect(ctx.mode).toBe('project');
    delete process.env.KB_MODE;
  });

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

describe('templates', () => {
  it('writeDefaultTemplates creates all 5 template files', () => {
    const paths = setupVault();
    const types = ['concept', 'entity', 'synthesis', 'analysis', 'source'];
    for (const t of types) {
      expect(existsSync(join(paths.templates, `${t}.md`))).toBe(true);
    }
    cleanup();
  });

  it('loadTemplate returns disk template when it exists', () => {
    const paths = setupVault();
    const tmpl = loadTemplate('concept', paths);
    expect(tmpl).toContain('---');
    expect(tmpl).toContain('type: concept');
    cleanup();
  });

  it('loadTemplate falls back to builtin when file missing', () => {
    const paths = setupVault();
    // Delete the disk template
    unlinkSync(join(paths.templates, 'concept.md'));
    const tmpl = loadTemplate('concept', paths);
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

// ─── metadata ────────────────────────────────────────────────────

describe('metadata', () => {
  it('parseFrontmatter extracts all fields', () => {
    const md = [
      '---',
      'type: concept',
      'title: My Page',
      'tags: [react, typescript]',
      'confidence: high',
      '---',
      'Body content here.',
    ].join('\n');
    const fm = parseFrontmatter(md);
    expect(fm.type).toBe('concept');
    expect(fm.title).toBe('My Page');
    expect(fm.tags).toEqual(['react', 'typescript']);
    expect(fm.confidence).toBe('high');
  });

  it('parseFrontmatter returns empty object for no frontmatter', () => {
    const fm = parseFrontmatter('Just markdown, no frontmatter.');
    expect(Object.keys(fm).length).toBe(0);
  });

  it('extractWikilinks finds all [[links]]', () => {
    const links = extractWikilinks('See [[React]] and [[TypeScript]] for details.');
    expect(links).toEqual(['React', 'TypeScript']);
  });

  it('extractWikilinks returns empty array for no links', () => {
    expect(extractWikilinks('No links here.')).toEqual([]);
  });

  it('rebuildMetadata creates registry and backlinks', () => {
    const paths = setupVault();
    // Create a wiki page
    const pageDir = join(paths.wiki, 'concepts');
    mkdirSync(pageDir, { recursive: true });
    writeFileSync(
      join(pageDir, 'react-intro.md'),
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

    expect(existsSync(join(paths.meta, 'registry.json'))).toBe(true);
    expect(existsSync(join(paths.meta, 'backlinks.json'))).toBe(true);

    const registry = JSON.parse(readFileSync(join(paths.meta, 'registry.json'), 'utf-8'));
    const entry = registry.find((e: { title: string }) => e.title === 'React Intro');
    expect(entry).toBeDefined();
    expect(entry.type).toBe('concept');
    expect(entry.tags).toEqual(['react']);

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

// ─── recall ──────────────────────────────────────────────────────

describe('recall', () => {
  it('tokenize splits into lowercase terms', () => {
    expect(tokenize('React TypeScript')).toEqual(['react', 'typescript']);
    expect(tokenize('  multi   space  ')).toEqual(['multi', 'space']);
  });

  it('searchWiki returns empty for empty vault', () => {
    const paths = setupVault();
    rebuildMetadata(paths);
    const results = searchWiki(paths, paths, 'anything', 'context', 5);
    expect(results.length).toBe(0);
    cleanup();
  });

  it('searchWiki ranks project first in context mode', () => {
    const paths = setupVault();

    // Create pages in both vaults (same vault for test)
    const conceptsDir = join(paths.wiki, 'concepts');
    mkdirSync(conceptsDir, { recursive: true });
    writeFileSync(
      join(conceptsDir, 'react-hooks.md'),
      '---\ntype: concept\ntitle: React Hooks\ntags: [react]\n---\nContent.'
    );
    writeFileSync(
      join(conceptsDir, 'vue-composables.md'),
      '---\ntype: concept\ntitle: Vue Composables\ntags: [vue]\n---\nContent.'
    );
    rebuildMetadata(paths);

    const results = searchWiki(paths, paths, 'react', 'context', 5);
    const reactResult = results.find((r) => r.id.includes('react'));
    expect(reactResult).toBeDefined();
    expect(reactResult?.score).toBeGreaterThan(0);
    cleanup();
  });

  it('formatRecallResults formats results as markdown', () => {
    const results = [
      {
        id: 'concepts/react',
        title: 'React',
        type: 'concept',
        path: 'concepts/react.md',
        tags: ['react'],
        score: 10,
        vault: 'project' as const,
      },
      {
        id: 'concepts/vue',
        title: 'Vue',
        type: 'concept',
        path: 'concepts/vue.md',
        tags: ['vue'],
        score: 5,
        vault: 'personal' as const,
      },
    ];
    const formatted = formatRecallResults(results);
    expect(formatted).toContain('## Relevant Wiki Knowledge');
    expect(formatted).toContain('React');
    expect(formatted).toContain('📁 project');
    expect(formatted).toContain('📓 personal');
  });

  it('formatRecallResults returns empty string for no results', () => {
    expect(formatRecallResults([])).toBe('');
  });

  it('searchByTag filters by tag', () => {
    const paths = setupVault();
    const conceptsDir = join(paths.wiki, 'concepts');
    mkdirSync(conceptsDir, { recursive: true });
    writeFileSync(
      join(conceptsDir, 'react-hooks.md'),
      '---\ntype: concept\ntitle: React Hooks\ntags: [react, hooks]\nstage: draft\n---\nContent.'
    );
    writeFileSync(
      join(conceptsDir, 'vue-composables.md'),
      '---\ntype: concept\ntitle: Vue Composables\ntags: [vue]\nstage: brainstorm\n---\nContent.'
    );
    rebuildMetadata(paths);

    const results = searchByTag(paths, paths, { tag: 'react' });
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('React Hooks');
    cleanup();
  });

  it('searchByTag filters by type', () => {
    const paths = setupVault();
    const conceptsDir = join(paths.wiki, 'concepts');
    const entitiesDir = join(paths.wiki, 'entities');
    mkdirSync(conceptsDir, { recursive: true });
    mkdirSync(entitiesDir, { recursive: true });
    writeFileSync(
      join(conceptsDir, 'async.md'),
      '---\ntype: concept\ntitle: Async Patterns\ntags: []\n---\nContent.'
    );
    writeFileSync(
      join(entitiesDir, 'fastapi.md'),
      '---\ntype: entity\ntitle: FastAPI\ntags: []\n---\nContent.'
    );
    rebuildMetadata(paths);

    const results = searchByTag(paths, paths, { type: 'entity' });
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('FastAPI');
    cleanup();
  });

  it('searchByTag filters by stage', () => {
    const paths = setupVault();
    const conceptsDir = join(paths.wiki, 'concepts');
    mkdirSync(conceptsDir, { recursive: true });
    writeFileSync(
      join(conceptsDir, 'draft-page.md'),
      '---\ntype: concept\ntitle: Draft Page\ntags: []\nstage: draft\n---\nContent.'
    );
    writeFileSync(
      join(conceptsDir, 'prod-page.md'),
      '---\ntype: concept\ntitle: Prod Page\ntags: []\nstage: production\n---\nContent.'
    );
    rebuildMetadata(paths);

    const results = searchByTag(paths, paths, { stage: 'production' });
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Prod Page');
    cleanup();
  });

  it('searchByTag returns empty for no filters', () => {
    const paths = setupVault();
    const results = searchByTag(paths, paths, {});
    expect(results.length).toBe(0);
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
