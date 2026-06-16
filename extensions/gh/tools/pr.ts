import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { gh } from '../api/gh';

export function registerPRTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'gh-pr-list',
    label: 'GitHub PRs',
    description: 'List pull requests in a repository',
    parameters: Type.Object({
      owner: Type.String({ description: 'Repository owner' }),
      repo: Type.String({ description: 'Repository name' }),
      state: Type.Optional(
        Type.String({ description: 'State: open|closed|merged|all', default: 'open' })
      ),
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
    }),
    async execute(_id, params) {
      const { owner, repo, state, limit } = params as {
        owner: string;
        repo: string;
        state?: string;
        limit?: number;
      };
      const r = gh([
        'pr',
        'list',
        '-R',
        `${owner}/${repo}`,
        `--state=${state ?? 'open'}`,
        `--limit=${limit ?? 20}`,
      ]);
      if (r.exitCode !== 0) return err(r.stderr || r.stdout);
      return ok(r.stdout, { owner, repo, state, limit });
    },
  });

  pi.registerTool({
    name: 'gh-pr-view',
    label: 'GitHub PR',
    description: 'View a pull request',
    parameters: Type.Object({
      owner: Type.String({ description: 'Repository owner' }),
      repo: Type.String({ description: 'Repository name' }),
      number: Type.Integer({ description: 'PR number' }),
    }),
    async execute(_id, params) {
      const { owner, repo, number } = params as {
        owner: string;
        repo: string;
        number: number;
      };
      const r = gh(['pr', 'view', String(number), '-R', `${owner}/${repo}`]);
      if (r.exitCode !== 0) return err(r.stderr || r.stdout);
      return ok(r.stdout, { owner, repo, number });
    },
  });

  pi.registerTool({
    name: 'gh-pr-create',
    label: 'GitHub PR Create',
    description: 'Create a pull request',
    parameters: Type.Object({
      owner: Type.String({ description: 'Repository owner' }),
      repo: Type.String({ description: 'Repository name' }),
      title: Type.String({ description: 'PR title' }),
      body: Type.Optional(Type.String({ description: 'PR body' })),
      base: Type.Optional(Type.String({ description: 'Base branch' })),
      draft: Type.Optional(Type.Boolean({ description: 'Create as draft' })),
    }),
    async execute(_id, params, _sig, _upd, ctx) {
      const p = params as {
        owner: string;
        repo: string;
        title: string;
        body?: string;
        base?: string;
        draft?: boolean;
      };
      const ok2 = await ctx.ui.confirm('Create PR?', p.title);
      if (!ok2) return err('Blocked: User denied PR creation');

      const args = ['pr', 'create', '-R', `${p.owner}/${p.repo}`, `--title=${p.title}`];
      if (p.body) args.push(`--body=${p.body}`);
      if (p.base) args.push(`--base=${p.base}`);
      if (p.draft) args.push('--draft');
      const r = gh(args);
      if (r.exitCode !== 0) return err(r.stderr || r.stdout);
      return ok(`PR created\n${r.stdout}`, { owner: p.owner, repo: p.repo });
    },
  });
}

function ok(text: string, details: Record<string, unknown> = {}) {
  return { content: [{ type: 'text' as const, text }], details };
}

function err(msg: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], details: { error: msg } };
}
