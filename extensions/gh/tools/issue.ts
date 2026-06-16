import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { gh } from '../api/gh';

export function registerIssueTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'gh-issue-list',
    label: 'GitHub Issues',
    description: 'List issues in a repository',
    parameters: Type.Object({
      owner: Type.String({ description: 'Repository owner' }),
      repo: Type.String({ description: 'Repository name' }),
      state: Type.Optional(Type.String({ description: 'State: open|closed|all', default: 'open' })),
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
        'issue',
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
    name: 'gh-issue-view',
    label: 'GitHub Issue',
    description: 'View an issue',
    parameters: Type.Object({
      owner: Type.String({ description: 'Repository owner' }),
      repo: Type.String({ description: 'Repository name' }),
      number: Type.Integer({ description: 'Issue number' }),
    }),
    async execute(_id, params) {
      const { owner, repo, number } = params as {
        owner: string;
        repo: string;
        number: number;
      };
      const r = gh(['issue', 'view', String(number), '-R', `${owner}/${repo}`]);
      if (r.exitCode !== 0) return err(r.stderr || r.stdout);
      return ok(r.stdout, { owner, repo, number });
    },
  });

  pi.registerTool({
    name: 'gh-issue-create',
    label: 'GitHub Issue Create',
    description: 'Create an issue',
    parameters: Type.Object({
      owner: Type.String({ description: 'Repository owner' }),
      repo: Type.String({ description: 'Repository name' }),
      title: Type.String({ description: 'Issue title' }),
      body: Type.Optional(Type.String({ description: 'Issue body' })),
      label: Type.Optional(Type.Array(Type.String(), { description: 'Labels to add' })),
    }),
    async execute(_id, params, _sig, _upd, ctx) {
      const p = params as {
        owner: string;
        repo: string;
        title: string;
        body?: string;
        label?: string[];
      };
      const ok2 = await ctx.ui.confirm('Create issue?', p.title);
      if (!ok2) return err('Blocked: User denied issue creation');

      const args = ['issue', 'create', '-R', `${p.owner}/${p.repo}`, `--title=${p.title}`];
      if (p.body) args.push(`--body=${p.body}`);
      if (p.label) args.push(`--label=${p.label.join(',')}`);
      const r = gh(args);
      if (r.exitCode !== 0) return err(r.stderr || r.stdout);
      return ok(`Issue created\n${r.stdout}`, { owner: p.owner, repo: p.repo });
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
