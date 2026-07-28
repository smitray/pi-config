import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { err, ok } from '../../_shared/result';
import type { AccessConfig } from '../lib/config';
import { searxngSearch, tfSearch } from '../lib/web-api';


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
      name: 'tf_search',
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
          const hits = await tfSearch(query, n, config);
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
