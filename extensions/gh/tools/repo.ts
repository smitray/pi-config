import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { gh } from '../api/gh';

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
      const r = gh(['repo', 'view', `${owner}/${repo}`]);
      if (r.exitCode !== 0) return err(r.stderr || r.stdout);
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
      if (!ok2) return err('Blocked: User denied clone');
      const args = ['repo', 'clone', `${owner}/${repo}`];
      if (dir) args.push(dir);
      const r = gh(args);
      if (r.exitCode !== 0) return err(r.stderr || r.stdout);
      return ok(`Cloned ${owner}/${repo}`, { owner, repo });
    },
  });
}

function ok(text: string, details: Record<string, unknown> = {}) {
  return { content: [{ type: 'text' as const, text }], details };
}

function err(msg: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], details: { error: msg } };
}
