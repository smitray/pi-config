import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { ghRepo, spawnErrorMessage } from '../api/gh';
import { err, ok } from '../lib/result';

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
      const r = await ghRepo(owner, repo, ['workflow', 'list']);
      if (!r.ok || r.exitCode !== 0) {
        return err('GH_FAILED', spawnErrorMessage(r), { owner, repo });
      }
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
      const args = ['run', 'list', `--limit=${limit ?? 10}`];
      if (workflow) args.push(`--workflow=${workflow}`);
      const r = await ghRepo(owner, repo, args);
      if (!r.ok || r.exitCode !== 0) {
        return err('GH_FAILED', spawnErrorMessage(r), { owner, repo });
      }
      return ok(r.stdout, { owner, repo });
    },
  });
}
