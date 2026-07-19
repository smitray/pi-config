import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { ok } from '../_shared/result';
import { runCommand } from '../_shared/spawn';

const skillsDir = join(dirname(fileURLToPath(import.meta.url)), 'skills');

async function run(cmd: string, args: string[], cwd: string): Promise<string> {
  const result = await runCommand(cmd, args, { cwd, timeoutMs: 30_000 });
  if (!result.ok)
    throw new Error(result.error || `${cmd} exited ${result.exitCode}: ${result.stderr}`);
  return result.stdout;
}

/**
 * ast — AST patterns (ast-grep) + structural code intelligence (codebase-memory-mcp).
 *
 * Tools:
 *   - ast_grep_search / ast_grep_replace: pattern-based via ast-grep CLI
 *   - code_search / code_trace / code_architecture: graph-based via codebase-memory-mcp
 */
export default function astExtension(pi: ExtensionAPI): void {
  // ── ast-grep pattern tools ───────────────────────────────────────────────

  pi.registerTool({
    name: 'ast_grep_search',
    label: 'AST Search',
    description:
      'Search code by AST pattern (semantic). Prefer over text grep for structured patterns.',
    parameters: Type.Object({
      pattern: Type.String({ description: 'AST pattern with $X metavars' }),
      paths: Type.Optional(Type.Array(Type.String())),
      lang: Type.Optional(Type.String()),
      insideKind: Type.Optional(Type.String()),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const args = ['run', '--pattern', params.pattern, '--json=compact'];
      if (params.lang) args.push('--lang', params.lang);
      if (params.paths?.length) args.push(...params.paths);
      const out = await run('ast-grep', args, ctx.cwd);
      return ok(out || 'No matches');
    },
  });

  pi.registerTool({
    name: 'ast_grep_replace',
    label: 'AST Replace',
    description: 'Replace AST pattern (dry-run by default).',
    parameters: Type.Object({
      pattern: Type.String(),
      rewrite: Type.String(),
      paths: Type.Optional(Type.Array(Type.String())),
      lang: Type.Optional(Type.String()),
      apply: Type.Optional(Type.Boolean()),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const args = [
        'run',
        '--pattern',
        params.pattern,
        '--rewrite',
        params.rewrite,
        '--json=compact',
      ];
      if (params.lang) args.push('--lang', params.lang);
      if (params.paths?.length) args.push(...params.paths);
      if (params.apply) args.push('--update-all');
      const out = await run('ast-grep', args, ctx.cwd);
      return ok(out || 'No matches');
    },
  });

  // ── codebase-memory-mcp graph tools ──────────────────────────────────────

  pi.registerTool({
    name: 'code_search',
    label: 'Code Search',
    description:
      'Search indexed code by name/regex via codebase-memory-mcp. Faster than grep, 99% fewer tokens. Run `codebase-memory-mcp cli index_repository` first if not indexed.',
    parameters: Type.Object({
      project: Type.String(),
      pattern: Type.String({ description: "Regex name pattern, e.g. '.*Handler.*'" }),
      label: Type.Optional(
        Type.String({ description: 'Node label: Function, Class, Method, Route, etc.' })
      ),
      limit: Type.Optional(Type.Number()),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      const json = JSON.stringify({
        project: params.project,
        name_pattern: params.pattern,
        ...(params.label ? { label: params.label } : {}),
        limit: params.limit ?? 20,
      });
      const out = await run('codebase-memory-mcp', ['cli', 'search_graph', json], process.cwd());
      return ok(out);
    },
  });

  pi.registerTool({
    name: 'code_trace',
    label: 'Code Trace',
    description: 'Trace callers/callees of a function via codebase-memory-mcp graph.',
    parameters: Type.Object({
      project: Type.String(),
      function: Type.String(),
      direction: Type.Optional(
        Type.String({ description: 'inbound (who calls), outbound (what it calls), both' })
      ),
      depth: Type.Optional(Type.Number()),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      const json = JSON.stringify({
        project: params.project,
        function_name: params.function,
        direction: params.direction ?? 'both',
        depth: params.depth ?? 3,
      });
      const out = await run('codebase-memory-mcp', ['cli', 'trace_path', json], process.cwd());
      return ok(out);
    },
  });

  pi.registerTool({
    name: 'code_architecture',
    label: 'Code Architecture',
    description:
      'Get codebase overview (languages, packages, routes, hotspots, clusters) via codebase-memory-mcp.',
    parameters: Type.Object({ project: Type.String() }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      const json = JSON.stringify({ project: params.project });
      const out = await run(
        'codebase-memory-mcp',
        ['cli', 'get_architecture', json],
        process.cwd()
      );
      return ok(out);
    },
  });

  pi.registerTool({
    name: 'code_index',
    label: 'Code Index',
    description: 'Index a repo into codebase-memory-mcp graph (ms-level queries).',
    parameters: Type.Object({ path: Type.String() }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      const json = JSON.stringify({ repo_path: params.path });
      const out = await run(
        'codebase-memory-mcp',
        ['cli', 'index_repository', json],
        process.cwd()
      );
      return ok(out);
    },
  });

  pi.on('resources_discover', () => ({ skillPaths: [skillsDir] }));
}
