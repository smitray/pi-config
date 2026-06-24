import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { ghRepo, spawnErrorMessage } from '../api/gh';
import { err, ok } from '../lib/result';

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
      const r = await ghRepo(owner, repo, [
        'issue',
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
      const r = await ghRepo(owner, repo, ['issue', 'view', String(number)]);
      if (!r.ok || r.exitCode !== 0) {
        return err('GH_FAILED', spawnErrorMessage(r), { owner, repo, number });
      }
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
      const dialogBody = [
        `**${p.title}**`,
        p.label?.length ? `labels: ${p.label.join(', ')}` : '',
        p.body ? `\n${p.body.slice(0, 200)}${p.body.length > 200 ? '…' : ''}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const confirmed = await ctx.ui.confirm(`Create issue in ${p.owner}/${p.repo}?`, dialogBody);
      if (!confirmed) return err('BLOCKED', 'User denied issue creation', p);

      const args = ['issue', 'create', `--title=${p.title}`];
      if (p.body) args.push(`--body=${p.body}`);
      if (p.label?.length) args.push(`--label=${p.label.join(',')}`);
      const r = await ghRepo(p.owner, p.repo, args);
      if (!r.ok) return err('ISSUE_CREATE_FAILED', r.stderr || r.error, p);
      if (r.exitCode !== 0) {
        return err('ISSUE_CREATE_FAILED', r.stderr || r.stdout, {
          ...p,
          exitCode: r.exitCode,
        });
      }
      return ok(`Issue created\n${r.stdout}`, {
        owner: p.owner,
        repo: p.repo,
        url: r.stdout.trim(),
      });
    },
  });
}
