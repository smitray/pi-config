import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { gh } from '../api/gh';

export function registerWorkflowTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'gh-workflow-list',
    label: 'GitHub Workflows',
    description: 'List GitHub Actions workflows',
    parameters: Type.Object({
      owner: Type.String({ description: 'Repository owner' }),
      repo: Type.String({ description: 'Repository name' }),
    }),
    async execute(_id, params) {
      const { owner, repo } = params as { owner: string; repo: string };
      const r = gh(['workflow', 'list', '-R', `${owner}/${repo}`]);
      if (r.exitCode !== 0) return err(r.stderr || r.stdout);
      return ok(r.stdout, { owner, repo });
    },
  });

  pi.registerTool({
    name: 'gh-run-list',
    label: 'GitHub Runs',
    description: 'List GitHub Actions workflow runs',
    parameters: Type.Object({
      owner: Type.String({ description: 'Repository owner' }),
      repo: Type.String({ description: 'Repository name' }),
      workflow: Type.Optional(Type.String({ description: 'Workflow name or file' })),
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    }),
    async execute(_id, params) {
      const { owner, repo, workflow, limit } = params as {
        owner: string;
        repo: string;
        workflow?: string;
        limit?: number;
      };
      const args = ['run', 'list', '-R', `${owner}/${repo}`, `--limit=${limit ?? 10}`];
      if (workflow) args.push(`--workflow=${workflow}`);
      const r = gh(args);
      if (r.exitCode !== 0) return err(r.stderr || r.stdout);
      return ok(r.stdout, { owner, repo });
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
