import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { gh } from '../api/gh';

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
      const r = gh(['search', 'repos', query, `--limit=${limit ?? 10}`]);
      if (r.exitCode !== 0) return err(r.stderr || r.stdout);
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
      const r = gh(['search', 'code', query, `--limit=${limit ?? 10}`]);
      if (r.exitCode !== 0) return err(r.stderr || r.stdout);
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
      const r = gh(['search', 'issues', query, `--limit=${limit ?? 10}`]);
      if (r.exitCode !== 0) return err(r.stderr || r.stdout);
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
      const r = gh(['search', 'prs', query, `--limit=${limit ?? 10}`]);
      if (r.exitCode !== 0) return err(r.stderr || r.stdout);
      return ok(r.stdout, { query });
    },
  });
}

function ok(text: string, details: Record<string, unknown> = {}) {
  return { content: [{ type: 'text' as const, text }], details };
}

function err(msg: string) {
  return {
    content: [{ type: 'text' as const, text: `Error: ${msg}` }],
    details: { error: msg },
  };
}
