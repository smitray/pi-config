import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { gh, spawnErrorMessage } from '../api/gh';
import { err, ok } from '../lib/result';

export function registerGistTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'gh-gist-list',
    label: 'GitHub Gists',
    description: 'List your GitHub gists',
    parameters: Type.Object({
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    }),
    async execute(_id, params) {
      const { limit } = params as { limit?: number };
      const r = await gh(['gist', 'list', `--limit=${limit ?? 10}`]);
      if (!r.ok || r.exitCode !== 0) {
        return err('GH_FAILED', spawnErrorMessage(r), {});
      }
      return ok(r.stdout, {});
    },
  });

  pi.registerTool({
    name: 'gh-gist-view',
    label: 'GitHub Gist',
    description: 'View a GitHub gist',
    parameters: Type.Object({
      id: Type.String({ description: 'Gist ID' }),
    }),
    async execute(_id, params) {
      const { id } = params as { id: string };
      const r = await gh(['gist', 'view', id]);
      if (!r.ok || r.exitCode !== 0) {
        return err('GH_FAILED', spawnErrorMessage(r), { id });
      }
      return ok(r.stdout, { id });
    },
  });

  pi.registerTool({
    name: 'gh-gist-create',
    label: 'GitHub Gist Create',
    description: 'Create a GitHub gist',
    parameters: Type.Object({
      filename: Type.String({ description: 'Filename' }),
      content: Type.String({ description: 'File content' }),
      description: Type.Optional(Type.String({ description: 'Gist description' })),
      public: Type.Optional(Type.Boolean({ description: 'Public gist', default: false })),
    }),
    async execute(_id, params, _sig, _upd, ctx) {
      const p = params as {
        filename: string;
        content: string;
        description?: string;
        public?: boolean;
      };
      const dialogBody = [
        `**${p.filename}**${p.public ? ' (public)' : ' (secret)'}`,
        p.description ?? '',
        p.content ? `\n${p.content.slice(0, 200)}${p.content.length > 200 ? '…' : ''}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const confirmed = await ctx.ui.confirm('Create gist?', dialogBody);
      if (!confirmed) return err('BLOCKED', 'User denied gist creation', { filename: p.filename });

      const args = ['gist', 'create', `--filename=${p.filename}`];
      if (p.public) args.push('--public');
      if (p.description) args.push(`--desc=${p.description}`);
      args.push('-');
      const r = await gh(args, p.content);
      if (!r.ok || r.exitCode !== 0) {
        return err('GIST_CREATE_FAILED', spawnErrorMessage(r), { filename: p.filename });
      }
      return ok(`Gist created\n${r.stdout}`, { filename: p.filename, url: r.stdout.trim() });
    },
  });
}
