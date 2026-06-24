import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import type { AccessConfig } from '../lib/config';
import { fetchJson } from '../lib/http';
import { err, ok } from '../lib/result';
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

export function registerWebSearch(pi: ExtensionAPI, config: AccessConfig): void {
  pi.registerTool({
    name: 'web-search',
    label: 'Web Search',
    description: 'Search the web via local SearXNG',
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
      const params2: Record<string, string> = { q: query, format: 'json' };
      if (language) params2.language = language;
      if (time_range) params2.time_range = time_range;

      const searchUrl = `${config.searxngBase}/search?${new URLSearchParams(params2)}`;

      try {
        const data = await fetchJson<SearxResponse>(searchUrl, {}, config);
        const hits: SearchHit[] = (data.results || []).slice(0, limit ?? 5).map((r) => ({
          title: r.title || r.url || '',
          url: r.url || '',
          snippet: r.content || '',
        }));

        const text = hits.length
          ? hits.map((h, i) => `${i + 1}. ${h.title}\n   ${h.url}\n   ${h.snippet}`).join('\n\n')
          : 'No results.';

        return ok(text, { query, results: hits });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return err('SEARCH_UNAVAILABLE', message, { query, url: searchUrl });
      }
    },
  });
}
