import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { err, ok } from '../../_shared/result';
import type { AccessConfig } from '../lib/config';
import {
  type DocsManifest,
  type DocsPage,
  deleteDocs,
  loadManifest,
  readPage,
  saveManifest,
  savePage,
} from '../lib/docs-store';
import { fetchJson, fetchText } from '../lib/http';
import { writePagesAsKbPackets } from '../lib/kb-packets';
import { approxTokens, extractLinks, extractTitle, splitIntoChunks } from '../lib/markdown';

// Re-export pure helpers so existing imports keep working.
export { approxTokens, extractLinks, extractTitle, splitIntoChunks };

interface MarkdownResponse {
  url?: string;
  markdown?: string;
  success?: boolean;
  error?: string;
}

interface RawPage {
  url: string;
  title: string;
  markdown: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ponytail: naive robots.txt parser — only blocks explicit "User-agent: *" +
// "Disallow: /". Upgrade to a real parser if path-specific rules matter.
// Inline XML parser: extracts <loc> from sitemap XML. No JSX/SAX dep needed.
function parseSitemapLocs(xml: string, baseHost: string): string[] {
  const urls: string[] = [];
  const locRe = /<loc[^>]*>([^<]+)<\/loc>/gi;
  let match: RegExpExecArray | null = locRe.exec(xml);
  while (match !== null) {
    try {
      const u = new URL(match[1].trim());
      if (u.hostname === baseHost) {
        u.hash = '';
        urls.push(u.href);
      }
    } catch {
      // malformed URL in sitemap, skip
    }
    match = locRe.exec(xml);
  }
  return urls;
}

async function fetchSitemapUrls(baseUrl: string, config: AccessConfig): Promise<string[]> {
  const base = new URL(baseUrl);
  const sitemapUrl = `${base.protocol}//${base.host}/sitemap.xml`;
  try {
    const xml = await fetchText(sitemapUrl, { method: 'GET' }, config);
    return parseSitemapLocs(xml, base.hostname);
  } catch {
    return []; // sitemap missing/unreachable, fall back to link-following
  }
}

async function checkRobotsTxt(
  baseUrl: string,
  config: AccessConfig
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const u = new URL(baseUrl);
    const robotsUrl = `${u.protocol}//${u.host}/robots.txt`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('timeout'), Math.min(5000, config.timeout));
    try {
      const res = await fetch(robotsUrl, { signal: controller.signal });
      if (!res.ok) return { allowed: true };
      const text = await res.text();
      if (!/User-agent:\s*\*/i.test(text)) return { allowed: true };
      for (const m of text.matchAll(/Disallow:\s*([^\s]+)/gi)) {
        if (m[1].trim() === '/') {
          return { allowed: false, reason: 'robots.txt disallows crawling for *' };
        }
      }
      return { allowed: true };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return { allowed: true };
  }
}

function pageFilename(index: number, title: string, url: string): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) ||
    new URL(url).pathname.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') ||
    'page';
  return `${String(index).padStart(4, '0')}-${slug}.md`;
}

export async function fetchSingleMd(
  url: string,
  config: AccessConfig
): Promise<{ url: string; markdown: string; title: string } | null> {
  try {
    const data = await fetchJson<MarkdownResponse>(
      `${config.crawl4aiBase}/md`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url, f: 'fit' }),
      },
      config
    );
    if (!data.success || !data.markdown) return null;
    return { url: data.url || url, markdown: data.markdown, title: extractTitle(data.markdown) };
  } catch {
    return null;
  }
}

export async function crawlDocs(
  baseUrl: string,
  maxDepth: number,
  config: AccessConfig
): Promise<RawPage[]> {
  const base = new URL(baseUrl);
  const robots = await checkRobotsTxt(baseUrl, config);
  if (!robots.allowed) {
    throw new Error(`Crawl blocked: ${robots.reason}`);
  }

  const pages: RawPage[] = [];
  const seen = new Set<string>([baseUrl]);
  const queue: Array<{ url: string; depth: number }> = [{ url: baseUrl, depth: 0 }];

  // ponytail: sitemap discovery — adds all sitemap URLs at depth 0 so the crawler
  // sees pages that might not be linked from any reachable page.
  // Ceiling: sitemap can add thousands of URLs; maxPages cap still applies.
  const sitemapUrls = await fetchSitemapUrls(baseUrl, config);
  for (const url of sitemapUrls) {
    if (!seen.has(url)) {
      seen.add(url);
      queue.push({ url, depth: 0 });
    }
  }

  while (queue.length > 0 && pages.length < config.maxPages) {
    const batchSize = Math.min(config.crawlConcurrency, queue.length);
    const batch = queue.splice(0, batchSize);

    const results = await Promise.all(
      batch.map(async (item) => {
        await sleep(config.crawlDelayMs);
        const page = await fetchSingleMd(item.url, config);
        return page ? { page, depth: item.depth } : null;
      })
    );

    for (const r of results) {
      if (!r) continue;
      pages.push(r.page);
      if (r.depth < maxDepth) {
        for (const link of extractLinks(r.page.markdown, r.page.url)) {
          if (seen.has(link)) continue;
          const linked = new URL(link);
          if (linked.hostname !== base.hostname) continue;
          seen.add(link);
          queue.push({ url: link, depth: r.depth + 1 });
        }
      }
    }
  }

  return pages;
}

interface ChunkCacheEntry {
  chunks: string[];
  pages: DocsPage[];
  totalTokens: number;
  baseUrl: string;
}

const chunkCache = new Map<string, ChunkCacheEntry>();

export function clearDocsChunkCache(): void {
  chunkCache.clear();
}

export function registerWebFetch(pi: ExtensionAPI, config: AccessConfig): void {
  pi.registerTool({
    name: 'web-fetch',
    label: 'Web Fetch',
    description: 'Fetch a single web page as markdown via Crawl4AI',
    parameters: Type.Object({
      url: Type.String({ description: 'URL to fetch' }),
      q: Type.Optional(Type.String({ description: 'Query for BM25/LLM filters' })),
      f: Type.Optional(
        Type.String({ description: 'Filter strategy: fit, raw, bm25, llm', default: 'fit' })
      ),
    }),
    async execute(_id, params) {
      const { url, q, f } = params as { url: string; q?: string; f?: string };
      const filter = f || 'fit';
      if ((filter === 'bm25' || filter === 'llm') && !q) {
        return err('MISSING_QUERY', `f="${filter}" requires q= parameter`, { url });
      }
      try {
        const data = await fetchJson<MarkdownResponse>(
          `${config.crawl4aiBase}/md`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ url, q, f: filter }),
          },
          config
        );
        if (!data.success) {
          return err('FETCH_FAILED', data.error || 'Crawl4AI returned failure', { url });
        }
        return ok(data.markdown || '', { url });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return err('FETCH_UNAVAILABLE', message, { url });
      }
    },
  });

  pi.registerTool({
    name: 'web-fetch-docs',
    label: 'Web Fetch Docs',
    description:
      'Recursively crawl a documentation site via Crawl4AI, persist pages to disk, and return chunked markdown for retrieval.',
    parameters: Type.Object({
      baseUrl: Type.String({ description: 'Starting documentation URL' }),
      label: Type.Optional(
        Type.String({ description: 'Cache label for chunk retrieval and on-disk persistence' })
      ),
      depth: Type.Optional(Type.Integer({ minimum: 1, maximum: 5, default: 3 })),
      chunkIndex: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
      refresh: Type.Optional(
        Type.Boolean({ description: 'Force re-crawl even if label exists on disk', default: false })
      ),
      kbRoot: Type.Optional(
        Type.String({
          description:
            'If set, write each crawled page as a KB source packet to {kbRoot}/raw/sources/ (one packet per page, deduplicated by URL).',
        })
      ),
    }),
    async execute(_id, params) {
      const { baseUrl, label, depth, chunkIndex, refresh, kbRoot } = params as {
        baseUrl: string;
        label?: string;
        depth?: number;
        chunkIndex?: number;
        refresh?: boolean;
        kbRoot?: string;
      };
      const requestedIndex = chunkIndex ?? 0;
      const effectiveDepth = depth ?? config.maxDepth;
      const cacheKey = label
        ? `disk::${label}::${effectiveDepth}`
        : `mem::${baseUrl}::${effectiveDepth}`;

      if (refresh && label) {
        deleteDocs(config, label);
        chunkCache.delete(cacheKey);
      }

      const existing = label ? loadManifest(config, label) : null;
      let pages: RawPage[];
      let persistedManifest: DocsManifest | null = existing;

      if (existing) {
        if (!label) {
          return err('MISSING_LABEL', 'label is required when loading from disk', { baseUrl });
        }
        pages = existing.pages.map((p) => ({
          url: p.url,
          title: p.title,
          markdown: readPage(config, label, p.file),
        }));
      } else {
        try {
          pages = await crawlDocs(baseUrl, effectiveDepth, config);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return err('CRAWL_FAILED', message, { baseUrl });
        }
        if (pages.length === 0) {
          return err('CRAWLER_EMPTY', 'No pages could be fetched', { baseUrl });
        }
        if (label) {
          const manifest: DocsManifest = {
            label,
            baseUrl,
            crawledAt: Date.now(),
            depth: effectiveDepth,
            pages: [],
          };
          pages.forEach((p, i) => {
            const filename = pageFilename(i, p.title, p.url);
            savePage(config, label, filename, p.markdown);
            manifest.pages.push({
              url: p.url,
              title: p.title,
              tokens: approxTokens(p.markdown),
              file: filename,
            });
          });
          saveManifest(config, manifest);
          persistedManifest = manifest;
        }
      }

      // Optional KB ingestion: write one source packet per page under {kbRoot}/raw/sources/.
      // Skipped on plain re-read (existing && !refresh) because packets were written on first crawl.
      let kbPackets: ReturnType<typeof writePagesAsKbPackets> = [];
      if (kbRoot && (!existing || refresh)) {
        kbPackets = writePagesAsKbPackets(
          pages.map((p) => ({ url: p.url, title: p.title, markdown: p.markdown })),
          kbRoot
        );
      }

      let cached = chunkCache.get(cacheKey);
      if (!cached) {
        const fullText = pages
          .map(
            (p) => `## URL: ${p.url}${p.title ? `\n**Title:** ${p.title}` : ''}\n\n${p.markdown}`
          )
          .join('\n\n---\n\n');
        const totalTokens = approxTokens(fullText);
        const chunks = splitIntoChunks(fullText, config.chunkTokens);
        const pagesList: DocsPage[] =
          persistedManifest?.pages ??
          pages.map((p, i) => ({
            url: p.url,
            title: p.title,
            tokens: approxTokens(p.markdown),
            file: pageFilename(i, p.title, p.url),
          }));
        cached = {
          chunks,
          pages: pagesList,
          totalTokens,
          baseUrl: persistedManifest?.baseUrl ?? baseUrl,
        };
        chunkCache.set(cacheKey, cached);
      }

      const chunk = cached.chunks[requestedIndex];
      if (!chunk) {
        return err('CHUNK_NOT_FOUND', `chunk ${requestedIndex} of ${cached.chunks.length}`, {
          label: label ?? null,
          totalChunks: cached.chunks.length,
        });
      }

      return ok(chunk, {
        label: label ?? null,
        baseUrl: cached.baseUrl,
        pages: cached.pages.map((p) => ({ url: p.url, title: p.title, tokens: p.tokens })),
        totalChunks: cached.chunks.length,
        chunkIndex: requestedIndex,
        totalTokens: cached.totalTokens,
        source: existing ? 'disk' : label ? 'fresh-disk' : 'memory',
        ...(kbRoot
          ? {
              kbRoot,
              kbPackets: kbPackets.map((p) => ({
                sourceId: p.sourceId,
                url: p.url,
                title: p.title,
                skipped: p.skipped ?? false,
              })),
              kbPacketsCreated: kbPackets.filter((p) => !p.skipped).length,
              kbPacketsSkipped: kbPackets.filter((p) => p.skipped).length,
            }
          : {}),
      });
    },
  });
}
