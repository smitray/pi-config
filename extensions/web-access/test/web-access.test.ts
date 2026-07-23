import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AccessConfig } from '../lib/config';
import { loadConfig } from '../lib/config';
import {
  chunkPages,
  type DocsManifest,
  deleteDocs,
  docsRoot,
  listLabels,
  loadManifest,
  saveManifest,
  savePage,
  searchDocs,
  tokenize,
} from '../lib/docs-store';
import { registerDocsTools } from '../tools/docs-tools';
import { registerMediaTools } from '../tools/media-cli';
import {
  approxTokens,
  extractLinks,
  extractTitle,
  registerWebFetch,
  splitIntoChunks,
} from '../tools/web-fetch';
import { registerWebSearch } from '../tools/web-search';

process.env.PI_SEARXNG_PORT = process.env.PI_SEARXNG_PORT || '8080';
process.env.PI_CRAWL4AI_PORT = process.env.PI_CRAWL4AI_PORT || '11234';

const config = loadConfig();

function createToolRecorder(config: AccessConfig) {
  const tools: Record<
    string,
    { execute: (...args: unknown[]) => Promise<Record<string, unknown>> }
  > = {};
  const pi = {
    registerTool(def: {
      name: string;
      execute: (...args: unknown[]) => Promise<Record<string, unknown>>;
    }) {
      tools[def.name] = def;
    },
  } as unknown as import('@earendil-works/pi-coding-agent').ExtensionAPI;

  registerWebSearch(pi, config);
  registerWebFetch(pi, config);
  registerMediaTools(pi, config);

  return tools;
}

async function isReachable(baseUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('timeout'), 5000);
    const res = await fetch(baseUrl, { signal: controller.signal, redirect: 'follow' });
    clearTimeout(timer);
    return res.ok || res.status === 307;
  } catch {
    return false;
  }
}

function isYtDlpAvailable(): boolean {
  try {
    execSync('command -v yt-dlp', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const searxngReachable = await isReachable(config.searxngBase);
const crawlReachable = await isReachable(config.crawl4aiBase);
const ytDlpReachable = isYtDlpAvailable();

const webSearchTests = searxngReachable ? describe : describe.skip;
const webFetchTests = crawlReachable ? describe : describe.skip;
const mediaTests = ytDlpReachable ? describe : describe.skip;

describe('access-web unit helpers', () => {
  it('approxTokens uses words * 1.3', () => {
    expect(approxTokens('one two three')).toBe(Math.ceil(3 * 1.3));
  });

  it('extractTitle reads first h1', () => {
    expect(extractTitle('# Hello\n\nbody')).toBe('Hello');
    expect(extractTitle('body')).toBe('');
  });

  it('splitIntoChunks respects section boundaries', () => {
    const text = '## A\nfoo bar\n## B\nbaz qux';
    const chunks = splitIntoChunks(text, 1000);
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toContain('## A');
    expect(chunks[0]).toContain('## B');
  });

  it('splitIntoChunks splits oversized sections', () => {
    const bigSection = `## Title\n${'word '.repeat(3000)}`;
    const chunks = splitIntoChunks(bigSection, 50);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('extractLinks keeps same-host absolute URLs', () => {
    const md = '[a](/x) [b](https://other.com/y) [c](https://example.com/z#frag)';
    const links = extractLinks(md, 'https://example.com/');
    expect(links).toContain('https://example.com/x');
    expect(links).toContain('https://example.com/z');
    expect(links).not.toContain('https://other.com/y');
  });
});

describe('media-cli unit helpers', async () => {
  const { validateMediaUrl, cleanSrt, extractJsonLine } = await import('../tools/media-cli');

  it('validateMediaUrl accepts http/https only', () => {
    expect(validateMediaUrl('https://example.com/video.mp4')).toBeNull();
    expect(validateMediaUrl('ftp://example.com/video')?.message).toContain('http/https');
    expect(validateMediaUrl('not a url')?.message).toContain('invalid URL');
  });

  it('cleanSrt strips timestamps and tags', () => {
    const raw = `1
00:00:01,000 --> 00:00:04,000
<b>Hello</b> [Music] world

2
00:00:05,000 --> 00:00:06,000
Second line
`;
    const cleaned = cleanSrt(raw);
    expect(cleaned).toContain('Hello');
    expect(cleaned).toContain('Second line');
    expect(cleaned).not.toContain('-->');
    expect(cleaned).not.toContain('[Music]');
    expect(cleaned).not.toContain('<b>');
  });

  it('extractJsonLine finds first JSON line', () => {
    expect(extractJsonLine('foo\n{"id":1}\nbar')).toEqual({ id: 1 });
    expect(extractJsonLine('foo\nbar')).toBeNull();
  });
});

webSearchTests('web-search integration', () => {
  it('searches SearXNG', async () => {
    const tools = createToolRecorder(config);
    const result = await tools['web-search'].execute('tc-1', { query: 'open source', limit: 3 });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toBeTruthy();
    expect(result.details?.results).toBeInstanceOf(Array);
    expect(((result.details.results as unknown[]) ?? []).length).toBeLessThanOrEqual(3);
  });
});

webFetchTests('web-fetch integration', { timeout: 30000 }, () => {
  it('fetches a page as markdown', async () => {
    const tools = createToolRecorder(config);
    const result = await tools['web-fetch'].execute('tc-1', { url: 'https://example.com' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text.toLowerCase()).toContain('example domain');
  });

  it('fetches a single docs chunk', async () => {
    const tools = createToolRecorder(config);
    const result = await tools['web-fetch-docs'].execute('tc-1', {
      baseUrl: 'https://example.com',
      label: `example-${Date.now()}`,
      depth: 1,
      chunkIndex: 0,
    });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toBeTruthy();
    expect(result.details?.totalChunks).toBeGreaterThanOrEqual(1);
  });
});

mediaTests('media-fetch integration', { timeout: 30000 }, () => {
  it('returns metadata for a public YouTube video', async () => {
    const tools = createToolRecorder(config);
    const result = await tools['media-fetch'].execute('tc-1', {
      url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
      mode: 'metadata',
    });
    expect(result.isError).toBeFalsy();
  });
});

// ---- docs-store + docs-tools (no network needed) --------------------------

const tmpRoot = mkdtempSync(join(tmpdir(), 'access-web-test-'));
const docsConfig: AccessConfig = { ...config, downloadDir: tmpRoot };

afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe('markdown helpers', () => {
  it('splitIntoChunks handles word-budget oversize sections', () => {
    const big = `## Title\n${'word '.repeat(3000)}`;
    const chunks = splitIntoChunks(big, 50);
    expect(chunks.length).toBeGreaterThan(1);
    // Each oversize chunk should be roughly the target word budget.
    for (const c of chunks) {
      expect(c.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(60);
    }
  });

  it('extractLinks handles protocol-relative URLs', () => {
    const md = '[r](/api) [a](//example.com/x) [b](https://other.com/y)';
    const links = extractLinks(md, 'https://example.com/');
    expect(links).toContain('https://example.com/api');
    expect(links).toContain('https://example.com/x');
    expect(links).not.toContain('https://other.com/y');
  });
});

describe('docs-store', () => {
  beforeAll(() => {
    const label = 'pinia';
    const manifest: DocsManifest = {
      label,
      baseUrl: 'https://pinia.vuejs.org/introduction.html',
      crawledAt: 1700000000000,
      depth: 2,
      pages: [
        {
          url: 'https://pinia.vuejs.org/introduction.html',
          title: 'Introduction',
          tokens: 200,
          file: '0000-introduction.md',
        },
        {
          url: 'https://pinia.vuejs.org/getting-started.html',
          title: 'Getting Started',
          tokens: 300,
          file: '0001-getting-started.md',
        },
        {
          url: 'https://pinia.vuejs.org/core-concepts/',
          title: 'Core Concepts',
          tokens: 500,
          file: '0002-core-concepts.md',
        },
      ],
    };
    saveManifest(docsConfig, manifest);
    savePage(
      docsConfig,
      label,
      '0000-introduction.md',
      '# Introduction\n\nPinia is the state management library for Vue. It provides getters, actions, and stores.'
    );
    savePage(
      docsConfig,
      label,
      '0001-getting-started.md',
      '# Getting Started\n\nInstall Pinia via npm install pinia. Then add it to your Vue app.'
    );
    savePage(
      docsConfig,
      label,
      '0002-core-concepts.md',
      '# Core Concepts\n\n## Getters\n\nGetters compute derived state. Getters receive the state as the first argument.\n\n## Actions\n\nActions handle business logic and async work.'
    );
  });

  it('round-trips manifest and pages through disk', () => {
    const m = loadManifest(docsConfig, 'pinia');
    expect(m).not.toBeNull();
    expect(m?.pages).toHaveLength(3);
    expect(m?.pages[0].url).toBe('https://pinia.vuejs.org/introduction.html');
  });

  it('listLabels returns directories under docs root', () => {
    const labels = listLabels(docsConfig);
    expect(labels).toContain('pinia');
  });

  it('chunkPages tags each chunk with source URL and title', () => {
    const m = loadManifest(docsConfig, 'pinia');
    if (!m) throw new Error('manifest missing');
    const chunks = chunkPages(m, docsConfig, 200);
    expect(chunks.length).toBeGreaterThan(0);
    for (const c of chunks) {
      expect(c.sourceUrl).toMatch(/^https:\/\/pinia\.vuejs\.org\//);
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.content.length).toBeGreaterThan(0);
    }
  });

  it('deleteDocs removes the label directory', () => {
    saveManifest(docsConfig, {
      label: 'temp',
      baseUrl: 'https://example.com',
      crawledAt: Date.now(),
      depth: 1,
      pages: [],
    });
    expect(listLabels(docsConfig)).toContain('temp');
    deleteDocs(docsConfig, 'temp');
    expect(listLabels(docsConfig)).not.toContain('temp');
  });

  it('tokenize drops short tokens and lowercases', () => {
    const toks = tokenize('The Pinia store has getters and actions');
    expect(toks).toContain('pinia');
    expect(toks).toContain('store');
    expect(toks).toContain('getters');
    expect(toks).toContain('actions');
    expect(toks).toContain('the'); // stop-word filter removed; IDF downweights it instead
    expect(toks).not.toContain('a');
  });

  it('searchDocs ranks relevant chunks above unrelated ones', () => {
    const m = loadManifest(docsConfig, 'pinia');
    if (!m) throw new Error('manifest missing');
    const chunks = chunkPages(m, docsConfig, 200);
    const ranked = searchDocs('getters', chunks, 3);
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0].score).toBeGreaterThan(0);
    // The getters chunk should be top-ranked.
    expect(ranked[0].title.toLowerCase()).toContain('core');
  });

  it('searchDocs returns empty results for non-matching query', () => {
    const m = loadManifest(docsConfig, 'pinia');
    if (!m) throw new Error('manifest missing');
    const chunks = chunkPages(m, docsConfig, 200);
    const ranked = searchDocs('cryptocurrency mining hash rate', chunks, 3);
    // All scores should be 0 — no term overlap.
    expect(ranked.every((r) => r.score === 0)).toBe(true);
  });
});

describe('docs tools (offline)', () => {
  function makeTools() {
    const tools: Record<
      string,
      { execute: (...args: unknown[]) => Promise<Record<string, unknown>> }
    > = {};
    const pi = {
      registerTool(def: {
        name: string;
        execute: (...args: unknown[]) => Promise<Record<string, unknown>>;
      }) {
        tools[def.name] = def;
      },
    } as unknown as import('@earendil-works/pi-coding-agent').ExtensionAPI;
    registerDocsTools(pi, docsConfig);
    return tools;
  }

  it('docs-list returns the seeded label', async () => {
    const tools = makeTools();
    const result = await tools['docs-list'].execute('tc-1', {});
    expect(result.isError).toBeFalsy();
    const labels = (result.details as { labels: Array<{ label: string }> }).labels;
    expect(labels.map((l) => l.label)).toContain('pinia');
  });

  it('docs-pages lists all pages when no url is given', async () => {
    const tools = makeTools();
    const result = await tools['docs-pages'].execute('tc-1', { label: 'pinia' });
    expect(result.isError).toBeFalsy();
    expect((result.details as { totalPages: number }).totalPages).toBe(3);
  });

  it('docs-pages fetches the full markdown of a specific page', async () => {
    const tools = makeTools();
    const result = await tools['docs-pages'].execute('tc-1', {
      label: 'pinia',
      url: 'https://pinia.vuejs.org/core-concepts/',
    });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('Getters');
  });

  it('docs-pages returns PAGE_NOT_FOUND for an unknown URL', async () => {
    const tools = makeTools();
    const result = await tools['docs-pages'].execute('tc-1', {
      label: 'pinia',
      url: 'https://pinia.vuejs.org/does-not-exist',
    });
    expect(result.isError).toBe(true);
    expect((result.details as { error: string }).error).toBe('PAGE_NOT_FOUND');
  });

  it('docs-pages returns DOCS_NOT_FOUND for an unknown label', async () => {
    const tools = makeTools();
    const result = await tools['docs-pages'].execute('tc-1', { label: 'nope' });
    expect(result.isError).toBe(true);
    expect((result.details as { error: string }).error).toBe('DOCS_NOT_FOUND');
  });

  it('docs-search returns ranked hits for a relevant query', async () => {
    const tools = makeTools();
    const result = await tools['docs-search'].execute('tc-1', {
      label: 'pinia',
      query: 'getters',
      topK: 3,
    });
    expect(result.isError).toBeFalsy();
    const results = (result.details as { results: Array<{ score: number }> }).results;
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBeGreaterThan(0);
  });
});

describe('web-fetch f=q validation', () => {
  function makeTools() {
    const tools: Record<
      string,
      { execute: (...args: unknown[]) => Promise<Record<string, unknown>> }
    > = {};
    const pi = {
      registerTool(def: {
        name: string;
        execute: (...args: unknown[]) => Promise<Record<string, unknown>>;
      }) {
        tools[def.name] = def;
      },
    } as unknown as import('@earendil-works/pi-coding-agent').ExtensionAPI;
    registerWebFetch(pi, docsConfig);
    return tools;
  }

  it('rejects f=bm25 without q', async () => {
    const tools = makeTools();
    const result = await tools['web-fetch'].execute('tc-1', {
      url: 'https://example.com',
      f: 'bm25',
    });
    expect(result.isError).toBe(true);
    expect((result.details as { error: string }).error).toBe('MISSING_QUERY');
  });
});

describe('docsRoot', () => {
  it('lives under downloadDir', () => {
    expect(docsRoot(docsConfig)).toBe(join(docsConfig.downloadDir, 'docs'));
  });
});
