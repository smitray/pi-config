import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { err, ok } from '../../_shared/result';
import type { AccessConfig } from '../lib/config';
import { chunkPages, listLabels, loadManifest, readPage, searchDocs } from '../lib/docs-store';

// In-memory chunk cache, cleared on session shutdown via the extension.
const chunksCache = new Map<string, ReturnType<typeof chunkPages>>();

export function clearDocsChunksCache(): void {
  chunksCache.clear();
}

function getChunks(config: AccessConfig, label: string) {
  const cached = chunksCache.get(label);
  if (cached) return cached;
  const manifest = loadManifest(config, label);
  if (!manifest) return null;
  const chunks = chunkPages(manifest, config);
  chunksCache.set(label, chunks);
  return chunks;
}

export function registerDocsTools(pi: ExtensionAPI, config: AccessConfig): void {
  pi.registerTool({
    name: 'docs-list',
    label: 'Docs List',
    description: 'List all locally stored documentation sets with page counts and sizes.',
    parameters: Type.Object({}),
    async execute() {
      const labels = listLabels(config);
      if (labels.length === 0) {
        return ok('No documentation sets stored. Use web-fetch-docs to crawl and persist one.', {
          labels: [],
        });
      }
      const summaries = labels.map((label) => {
        const manifest = loadManifest(config, label);
        if (!manifest) return { label, error: 'manifest unreadable' };
        return {
          label,
          baseUrl: manifest.baseUrl,
          crawledAt: manifest.crawledAt,
          depth: manifest.depth,
          pages: manifest.pages.length,
          totalTokens: manifest.pages.reduce((s, p) => s + p.tokens, 0),
        };
      });
      const text = summaries
        .map((s) => {
          if ('error' in s) return `- ${s.label} (${s.error})`;
          const date = new Date(s.crawledAt).toISOString().slice(0, 10);
          return `- **${s.label}** (${s.pages} pages, ${s.totalTokens} tokens, depth ${s.depth}, crawled ${date})\n  base: ${s.baseUrl}`;
        })
        .join('\n');
      return ok(text, { labels: summaries });
    },
  });

  pi.registerTool({
    name: 'docs-pages',
    label: 'Docs Pages',
    description:
      'List pages in a stored docs set, or fetch the full markdown of a specific page by URL.',
    parameters: Type.Object({
      label: Type.String({ description: 'Docs label' }),
      url: Type.Optional(
        Type.String({ description: 'Exact URL of the page to fetch (omit to list all pages)' })
      ),
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000, default: 200 })),
    }),
    async execute(_id, params) {
      const { label, url, limit } = params as {
        label: string;
        url?: string;
        limit?: number;
      };
      const manifest = loadManifest(config, label);
      if (!manifest) {
        return err(
          'DOCS_NOT_FOUND',
          `No docs labeled "${label}". Run docs-list to see available labels.`,
          { label }
        );
      }

      if (url) {
        const page = manifest.pages.find((p) => p.url === url);
        if (!page) {
          const sample = manifest.pages.slice(0, 5).map((p) => p.url);
          return err(
            'PAGE_NOT_FOUND',
            `URL not found in "${label}". Use docs-pages label=${label} to list available URLs.`,
            {
              label,
              requestedUrl: url,
              availableSample: sample,
              totalPages: manifest.pages.length,
            }
          );
        }
        const content = readPage(config, label, page.file);
        return ok(content, {
          label,
          page: { url: page.url, title: page.title, tokens: page.tokens },
        });
      }

      const max = limit ?? 200;
      const slice = manifest.pages.slice(0, max);
      const text = slice
        .map((p) => `- [${p.title || '(untitled)'}](${p.url}) — ${p.tokens} tokens`)
        .join('\n');
      const suffix =
        manifest.pages.length > slice.length
          ? `\n\n(showing ${slice.length} of ${manifest.pages.length}; raise limit to see more)`
          : '';
      return ok(text + suffix, {
        label,
        totalPages: manifest.pages.length,
        returned: slice.length,
        pages: slice.map((p) => ({ url: p.url, title: p.title, tokens: p.tokens })),
      });
    },
  });

  pi.registerTool({
    name: 'docs-search',
    label: 'Docs Search',
    description:
      'Keyword search over a persisted docs set. Returns ranked chunks with source URL and title. Uses TF-IDF, not semantic — exact terms work best.',
    parameters: Type.Object({
      label: Type.String({ description: 'Docs label' }),
      query: Type.String({ description: 'Search query' }),
      topK: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 5 })),
    }),
    async execute(_id, params) {
      const { label, query, topK } = params as {
        label: string;
        query: string;
        topK?: number;
      };
      const manifest = loadManifest(config, label);
      if (!manifest) {
        return err(
          'DOCS_NOT_FOUND',
          `No docs labeled "${label}". Run docs-list to see available labels.`,
          { label }
        );
      }
      const chunks = getChunks(config, label);
      if (!chunks || chunks.length === 0) {
        return err('NO_CHUNKS', 'No content to search', { label });
      }
      const k = topK ?? 5;
      const ranked = searchDocs(query, chunks, k);
      const text =
        ranked.length === 0
          ? 'No matches.'
          : ranked
              .map((r, i) => {
                const snippet = r.content.length > 600 ? `${r.content.slice(0, 600)}…` : r.content;
                return `${i + 1}. **${r.title || '(untitled)'}**\n   ${r.sourceUrl}\n   score: ${r.score.toFixed(3)} | tokens: ${r.tokens}\n   ${snippet}`;
              })
              .join('\n\n');
      return ok(text, {
        label,
        query,
        totalChunks: chunks.length,
        results: ranked.map((r) => ({
          sourceUrl: r.sourceUrl,
          title: r.title,
          score: r.score,
          tokens: r.tokens,
          snippet: r.content.slice(0, 200),
        })),
      });
    },
  });
}
