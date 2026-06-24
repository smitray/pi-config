import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { ghRepo, spawnErrorMessage } from '../api/gh';
import { err, ok } from '../lib/result';

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
      const r = await ghRepo(owner, repo, [
        'pr',
        'list',
        `--state=${state ?? 'open'}`,
        `--limit=${limit ?? 20}`,
      ]);
      if (!r.ok || r.exitCode !== 0) {
        return err('GH_FAILED', spawnErrorMessage(r), { owner, repo });
      }
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
      const r = await ghRepo(owner, repo, ['pr', 'view', String(number)]);
      if (!r.ok || r.exitCode !== 0) {
        return err('GH_FAILED', spawnErrorMessage(r), { owner, repo, number });
      }
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
      const dialogBody = [
        `**${p.title}**`,
        p.base ? `→ ${p.base}` : '',
        p.draft ? '(draft)' : '',
        p.body ? `\n${p.body.slice(0, 200)}${p.body.length > 200 ? '…' : ''}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const confirmed = await ctx.ui.confirm(`Create PR in ${p.owner}/${p.repo}?`, dialogBody);
      if (!confirmed) return err('BLOCKED', 'User denied PR creation', p);

      const args = ['pr', 'create', `--title=${p.title}`];
      if (p.body) args.push(`--body=${p.body}`);
      if (p.base) args.push(`--base=${p.base}`);
      if (p.draft) args.push('--draft');
      const r = await ghRepo(p.owner, p.repo, args);
      if (!r.ok) return err('PR_CREATE_FAILED', r.stderr || r.error, p);
      if (r.exitCode !== 0) {
        return err('PR_CREATE_FAILED', r.stderr || r.stdout, { ...p, exitCode: r.exitCode });
      }
      return ok(`PR created\n${r.stdout}`, { owner: p.owner, repo: p.repo, url: r.stdout.trim() });
    },
  });
}
