import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { err, ok } from '../../_shared/result';
import { gh, spawnErrorMessage } from '../api/gh';

export function registerRepoTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'gh-repo-view',
    label: 'GitHub Repo',
    description: 'View a GitHub repository (owner/repo)',
    parameters: Type.Object({
      owner: Type.String({ description: 'Repository owner' }),
      repo: Type.String({ description: 'Repository name' }),
    }),
    async execute(_id, params) {
      const { owner, repo } = params as { owner: string; repo: string };
      const r = await gh(['repo', 'view', `${owner}/${repo}`]);
      if (!r.ok) {
        return err('GH_FAILED', r.stderr || r.error || 'gh repo view failed', {
          owner,
          repo,
          exitCode: r.exitCode,
        });
      }
      if (r.exitCode !== 0) {
        return err('GH_NONZERO', r.stderr || r.stdout, { owner, repo, exitCode: r.exitCode });
      }
      return ok(r.stdout, { owner, repo });
    },
  });

  pi.registerTool({
    name: 'gh-repo-clone',
    label: 'GitHub Clone',
    description: 'Clone a GitHub repository',
    parameters: Type.Object({
      owner: Type.String({ description: 'Repository owner' }),
      repo: Type.String({ description: 'Repository name' }),
      dir: Type.Optional(Type.String({ description: 'Target directory' })),
    }),
    async execute(_id, params, _sig, _upd, ctx) {
      const { owner, repo, dir } = params as {
        owner: string;
        repo: string;
        dir?: string;
      };
      const ok2 = await ctx.ui.confirm(
        'Clone repository?',
        `${owner}/${repo}${dir ? ` → ${dir}` : ''}`
      );
      if (!ok2) return err('BLOCKED', 'User denied clone', { owner, repo });

      const args = ['repo', 'clone', `${owner}/${repo}`];
      if (dir) args.push(dir);
      const r = await gh(args);
      if (!r.ok || r.exitCode !== 0) {
        return err('CLONE_FAILED', spawnErrorMessage(r), { owner, repo, exitCode: r.exitCode });
      }
      return ok(`Cloned ${owner}/${repo}${dir ? ` to ${dir}` : ''}`, { owner, repo, dir });
    },
  });
}
