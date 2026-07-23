import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { err, ok } from '../../_shared/result';
import type { AccessConfig } from '../lib/config';
import { fetchJson } from '../lib/http';
import type { SearchHit } from '../lib/types';

interface SearxResponse {
  query?: string;
  number_of_results?: number;
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
  }>;
}

interface TinyFishSearchResult {
  position?: number;
  site_name?: string;
  snippet?: string;
  title?: string;
  url?: string;
}

interface TinyFishSearchResponse {
  query?: string;
  results?: TinyFishSearchResult[];
  error?: { code?: string; message?: string };
}

async function tinyfishSearch(
  query: string,
  limit: number,
  config: AccessConfig
): Promise<SearchHit[]> {
  const params = new URLSearchParams({ query, limit: String(limit) });
  const url = `${config.tinyfishSearchBase}?${params}`;
  const data = await fetchJson<TinyFishSearchResponse>(
    url,
    {
      headers: { 'X-API-Key': config.tinyfishApiKey ?? '' },
    },
    config
  );
  if (data.error) throw new Error(data.error.message || 'TinyFish search error');
  return (data.results || []).slice(0, limit).map((r) => ({
    title: r.title || r.url || '',
    url: r.url || '',
    snippet: r.snippet || '',
  }));
}

async function searxngSearch(
  query: string,
  limit: number,
  language: string | undefined,
  time_range: string | undefined,
  config: AccessConfig
): Promise<SearchHit[]> {
  const params: Record<string, string> = { q: query, format: 'json' };
  if (language) params.language = language;
  if (time_range) params.time_range = time_range;
  const searchUrl = `${config.searxngBase}/search?${new URLSearchParams(params)}`;
  const data = await fetchJson<SearxResponse>(searchUrl, {}, config);
  return (data.results || []).slice(0, limit).map((r) => ({
    title: r.title || r.url || '',
    url: r.url || '',
    snippet: r.content || '',
  }));
}

export function registerWebSearch(pi: ExtensionAPI, config: AccessConfig): void {
  pi.registerTool({
    name: 'web-search',
    label: 'Web Search',
    description: 'Search the web via local SearXNG. Use tinyfish_search for TinyFish.',
    parameters: Type.Object({
      query: Type.String({ description: 'Search query' }),
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 5 })),
      language: Type.Optional(
        Type.String({ description: 'Language code (e.g., en, de, all). SearXNG-specific.' })
      ),
      time_range: Type.Optional(
        Type.String({ description: 'day | week | month | year | empty for all-time' })
      ),
    }),
    async execute(_id, params) {
      const { query, limit, language, time_range } = params as {
        query: string;
        limit?: number;
        language?: string;
        time_range?: string;
      };
      const n = limit ?? 5;

      try {
        const hits = await searxngSearch(query, n, language, time_range, config);
        const text = hits.length
          ? hits.map((h, i) => `${i + 1}. ${h.title}\n   ${h.url}\n   ${h.snippet}`).join('\n\n')
          : 'No results.';
        return ok(text, { query, results: hits, source: 'searxng' });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return err('SEARCH_UNAVAILABLE', message, { query });
      }
    },
  });

  // TinyFish Search — opt-in only, requires PI_TINYFISH_API_KEY
  if (config.tinyfishApiKey) {
    pi.registerTool({
      name: 'tinyfish_search',
      label: 'TinyFish Search',
      description:
        'Search the web via TinyFish API (structured results, cleaner than SearXNG). Free tier available.',
      parameters: Type.Object({
        query: Type.String({ description: 'Search query' }),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 5 })),
      }),
      async execute(_id, params) {
        const { query, limit } = params as { query: string; limit?: number };
        const n = limit ?? 5;

        try {
          const hits = await tinyfishSearch(query, n, config);
          const text = hits.length
            ? hits.map((h, i) => `${i + 1}. ${h.title}\n   ${h.url}\n   ${h.snippet}`).join('\n\n')
            : 'No results.';
          return ok(text, { query, results: hits, source: 'tinyfish' });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return err('TINYFISH_SEARCH_UNAVAILABLE', message, { query });
        }
      },
    });
  }
}
