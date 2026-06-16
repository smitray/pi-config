import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { gh } from '../api/gh';

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
      const r = gh(['gist', 'list', `--limit=${limit ?? 10}`]);
      if (r.exitCode !== 0) return err(r.stderr || r.stdout);
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
      const r = gh(['gist', 'view', id]);
      if (r.exitCode !== 0) return err(r.stderr || r.stdout);
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
      const ok2 = await ctx.ui.confirm('Create gist?', p.filename);
      if (!ok2) return err('Blocked: User denied gist creation');

      const args = ['gist', 'create', `--filename=${p.filename}`];
      if (p.public) args.push('--public');
      if (p.description) args.push(`--desc=${p.description}`);
      const r = gh([...args, '-'], p.content);
      if (r.exitCode !== 0) return err(r.stderr || r.stdout);
      return ok(`Gist created\n${r.stdout}`, { filename: p.filename });
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
