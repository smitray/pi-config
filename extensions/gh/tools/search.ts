import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { gh, spawnErrorMessage } from '../api/gh';
import { err, ok } from '../lib/result';

export function registerSearchTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'gh-search-repos',
    label: 'GitHub Search Repos',
    description: 'Search GitHub repositories',
    parameters: Type.Object({
      query: Type.String({ description: 'Search query' }),
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    }),
    async execute(_id, params) {
      const { query, limit } = params as { query: string; limit?: number };
      const r = await gh(['search', 'repos', query, `--limit=${limit ?? 10}`]);
      if (!r.ok || r.exitCode !== 0) {
        return err('GH_FAILED', spawnErrorMessage(r), { query });
      }
      return ok(r.stdout, { query });
    },
  });

  pi.registerTool({
    name: 'gh-search-code',
    label: 'GitHub Search Code',
    description: 'Search code across GitHub',
    parameters: Type.Object({
      query: Type.String({ description: 'Search query (GitHub code search syntax)' }),
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    }),
    async execute(_id, params) {
      const { query, limit } = params as { query: string; limit?: number };
      const r = await gh(['search', 'code', query, `--limit=${limit ?? 10}`]);
      if (!r.ok || r.exitCode !== 0) {
        return err('GH_FAILED', spawnErrorMessage(r), { query });
      }
      return ok(r.stdout, { query });
    },
  });

  pi.registerTool({
    name: 'gh-search-issues',
    label: 'GitHub Search Issues',
    description: 'Search issues across GitHub',
    parameters: Type.Object({
      query: Type.String({ description: 'Search query' }),
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    }),
    async execute(_id, params) {
      const { query, limit } = params as { query: string; limit?: number };
      const r = await gh(['search', 'issues', query, `--limit=${limit ?? 10}`]);
      if (!r.ok || r.exitCode !== 0) {
        return err('GH_FAILED', spawnErrorMessage(r), { query });
      }
      return ok(r.stdout, { query });
    },
  });

  pi.registerTool({
    name: 'gh-search-prs',
    label: 'GitHub Search PRs',
    description: 'Search pull requests across GitHub',
    parameters: Type.Object({
      query: Type.String({ description: 'Search query' }),
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    }),
    async execute(_id, params) {
      const { query, limit } = params as { query: string; limit?: number };
      const r = await gh(['search', 'prs', query, `--limit=${limit ?? 10}`]);
      if (!r.ok || r.exitCode !== 0) {
        return err('GH_FAILED', spawnErrorMessage(r), { query });
      }
      return ok(r.stdout, { query });
    },
  });
}
