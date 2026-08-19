import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { err, ok } from '../../_shared/result';
import { type RegistryEntry, rebuildMetadata } from './metadata';
import { buildPage } from './templates';
import {
  buildVaultPaths,
  DIR_NAMES,
  fmtDate,
  readJson,
  resolveVaultContext,
  type VaultPaths,
} from './vault';

// ponytail: handoff chains are a linked list stored in frontmatter
// (from_handoff / to_handoff) and indexed in meta/registry.json.

/** Registry entries carry relPath as id; extract the typed ID (HOFF-/TASK-) from it. */
export function idFromPath(path: string): string {
  const m = path.match(/(HOFF-\d{8}-\d+|TASK-\d+)/);
  return m ? m[1] : path;
}

export interface HandoffInput {
  stage: string;
  task?: string;
  project?: string;
  status: 'pending' | 'in-progress' | 'done' | 'failed' | 'skipped';
  summary: string;
  skipReason?: string;
  run?: string;
  body?: string;
}

export function getNextHandoffId(paths: VaultPaths): string {
  const today = fmtDate().replaceAll('-', '');
  const dir = join(paths.wiki, DIR_NAMES.handoff);
  const prefix = `HOFF-${today}`;
  let max = 0;
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      const m = f.match(/HOFF-\d{8}-(\d+)/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

/**
 * Create a handoff page, chaining it to the current end of the task's chain.
 * Returns the new handoff id.
 */
export function createHandoff(
  paths: VaultPaths,
  input: HandoffInput
): { id: string; fromHandoff: string | null } {
  const id = getNextHandoffId(paths);
  const registry = readJson<RegistryEntry[]>(join(paths.meta, 'registry.json')) ?? [];

  // Current end of the chain: last handoff for this task with no to_handoff.
  const prev = registry
    .filter(
      (e) =>
        e.type === 'handoff' &&
        e.project === input.project &&
        (input.task ? e.task === input.task : true)
    )
    .sort((a, b) => (a.created < b.created ? 1 : -1))
    .find((e) => !e.to_handoff && idFromPath(e.id) !== id);

  const fromHandoff = prev ? idFromPath(prev.id) : null;
  const title = input.task
    ? `${input.task} · ${input.stage} handoff`
    : `${input.project ?? 'project'} · ${input.stage} handoff`;

  const { content, filename } = buildPage('handoff', title, paths, {
    id,
    stage: input.stage,
    task: input.task ?? '',
    project: input.project ?? '',
    status: input.status,
    skip_reason: input.skipReason ?? '',
    run: input.run ?? '',
    from_handoff: fromHandoff ?? '',
    to_handoff: '',
    summary: input.summary,
  });

  const dir = join(paths.wiki, DIR_NAMES.handoff);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const fullContent = input.body ? `${content}\n\n${input.body}` : content;
  writeFileSync(join(dir, filename), fullContent, 'utf-8');

  // Close the previous handoff's to_handoff pointer.
  if (prev) {
    const prevPath = join(paths.wiki, prev.path);
    if (existsSync(prevPath)) {
      const prevContent = readFileSync(prevPath, 'utf-8');
      const updated = prevContent.replace(/(^to_handoff:\s*").*?(")/m, `$1${id}$2`);
      writeFileSync(prevPath, updated, 'utf-8');
    }
  }

  rebuildMetadata(paths);
  return { id, fromHandoff };
}

function vaultFromCtx(cwd: string): VaultPaths {
  const { root } = resolveVaultContext(cwd);
  return buildVaultPaths(root);
}

export function registerHandoffTools(pi: ExtensionAPI): void {
  // ─── kb_create_handoff ───────────────────────────────────────
  pi.registerTool({
    name: 'kb_create_handoff',
    label: 'KB Create Handoff',
    description:
      'Record a handoff page with chain pointers. Handoffs are the audit trail; ' +
      'the from_handoff/to_handoff pointers stitch a linked list per task.',
    promptSnippet: 'Record a stage handoff',
    promptGuidelines: [
      'Use kb_create_handoff at the end of every stage to record what was decided/done.',
    ],
    parameters: Type.Object({
      stage: Type.String({
        description:
          'Stage name (brainstorm | design | spec | understand | execute | test | check | loop-back | ...)',
      }),
      summary: Type.String({ description: 'One-line description of what was decided/done' }),
      task: Type.Optional(Type.String({ description: 'Task ID (e.g. TASK-001), if task-scoped' })),
      project: Type.Optional(Type.String({ description: 'Project ID (e.g. PROJ-001)' })),
      status: Type.Optional(
        Type.String({
          description: 'Status: pending | in-progress | done | failed | skipped',
          default: 'done',
        })
      ),
      skip_reason: Type.Optional(
        Type.String({ description: 'Required when status=skipped — why the stage was skipped' })
      ),
      run: Type.Optional(Type.String({ description: 'Flow run ID (e.g. RUN-2026-08-05-001)' })),
      body: Type.Optional(Type.String({ description: 'Detailed handoff body content' })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd ?? process.cwd();
      const paths = vaultFromCtx(cwd);
      if (!existsSync(join(paths.dotKb, 'config.json'))) {
        return err('NO_VAULT', 'No KB vault found. Run `kb_bootstrap` first.');
      }
      const result = createHandoff(paths, {
        stage: params.stage,
        task: params.task,
        project: params.project,
        status: params.status as HandoffInput['status'],
        summary: params.summary,
        skipReason: params.skip_reason,
        run: params.run,
        body: params.body,
      });
      return ok(`✅ Handoff created [${result.id}] — ${params.summary}`, {
        id: result.id,
        fromHandoff: result.fromHandoff,
      });
    },
  });

  // ─── kb_list_handoffs ────────────────────────────────────────
  pi.registerTool({
    name: 'kb_list_handoffs',
    label: 'KB List Handoffs',
    description:
      'Query handoffs by stage, task, project, or status. Returns a table of the audit trail.',
    promptSnippet: 'List handoffs',
    promptGuidelines: [
      'Use kb_list_handoffs to review the audit trail filtered by stage/task/project/status.',
    ],
    parameters: Type.Object({
      stage: Type.Optional(Type.String({ description: 'Filter by stage' })),
      task: Type.Optional(Type.String({ description: 'Filter by task ID' })),
      project: Type.Optional(Type.String({ description: 'Filter by project ID' })),
      status: Type.Optional(Type.String({ description: 'Filter by status' })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd ?? process.cwd();
      const paths = vaultFromCtx(cwd);
      const registry = readJson<RegistryEntry[]>(join(paths.meta, 'registry.json')) ?? [];
      let handoffs = registry.filter((e) => e.type === 'handoff');
      if (params.stage) handoffs = handoffs.filter((h) => h.stage === params.stage);
      if (params.task) handoffs = handoffs.filter((h) => h.task === params.task);
      if (params.project) handoffs = handoffs.filter((h) => h.project === params.project);
      if (params.status) handoffs = handoffs.filter((h) => h.status === params.status);

      if (handoffs.length === 0) return ok('No handoffs match the given filters.', { count: 0 });

      const lines = [
        `## ${handoffs.length} Handoff(s)`,
        '',
        '| ID | Stage | Task | Project | Status | Summary |',
        '|----|-------|------|---------|--------|---------|',
        ...handoffs.map(
          (h) =>
            `| ${h.id} | ${h.stage} | ${h.task || '-'} | ${h.project || '-'} | ${h.status || '-'} | ${(h as unknown as { summary?: string }).summary || ''} |`
        ),
      ];
      return ok(lines.join('\n'), { count: handoffs.length, handoffs });
    },
  });

  // ─── kb_get_handoff_chain ────────────────────────────────────
  pi.registerTool({
    name: 'kb_get_handoff_chain',
    label: 'KB Get Handoff Chain',
    description: 'Returns the ordered handoff chain for a task, walked via chain pointers.',
    promptSnippet: 'Show handoff chain for a task',
    promptGuidelines: ['Use kb_get_handoff_chain to see the full work history of a task.'],
    parameters: Type.Object({
      task: Type.String({ description: 'Task ID (e.g. TASK-001)' }),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd ?? process.cwd();
      const paths = vaultFromCtx(cwd);
      const registry = readJson<RegistryEntry[]>(join(paths.meta, 'registry.json')) ?? [];
      const byId = new Map(
        registry.filter((e) => e.type === 'handoff').map((h) => [idFromPath(h.id), h])
      );

      // Find chain head: no from_handoff.
      const head = registry.find(
        (h) => h.type === 'handoff' && h.task === params.task && !h.from_handoff
      );
      if (!head) return err('NO_CHAIN', `No handoff chain found for task ${params.task}`);

      const chain: RegistryEntry[] = [];
      let current: RegistryEntry | undefined = head;
      while (current) {
        chain.push(current);
        current = current.to_handoff ? byId.get(current.to_handoff) : undefined;
      }

      const lines = [
        `## Handoff Chain — ${params.task}`,
        '',
        ...chain.map(
          (h, i) =>
            `${i + 1}. \`${h.id}\` [${h.stage}] (${h.status}) — ${(h as unknown as { summary?: string }).summary || ''}`
        ),
        '',
        `**${chain.length} handoff(s)** — ${chain[chain.length - 1]?.to_handoff ? 'chain continues' : 'chain end reached'}`,
      ];
      return ok(lines.join('\n'), { count: chain.length, chain: chain.map((h) => h.id) });
    },
  });

  // ─── kb_get_project_state ────────────────────────────────────
  pi.registerTool({
    name: 'kb_get_project_state',
    label: 'KB Get Project State',
    description:
      'Returns current pipeline state for a project: which tasks are at which stage, what is blocked, what is done.',
    promptSnippet: 'Show project pipeline state',
    promptGuidelines: ['Use kb_get_project_state to see where every task in a project stands.'],
    parameters: Type.Object({
      project: Type.String({ description: 'Project ID (e.g. PROJ-001)' }),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd ?? process.cwd();
      const paths = vaultFromCtx(cwd);
      const registry = readJson<RegistryEntry[]>(join(paths.meta, 'registry.json')) ?? [];
      const tasks = registry.filter((e) => e.type === 'task' && e.project === params.project);
      const handoffs = registry.filter((e) => e.type === 'handoff' && e.project === params.project);

      // Latest handoff per task = current stage.
      const latestPerTask = new Map<string, RegistryEntry>();
      for (const h of handoffs) {
        if (!h.task) continue;
        const cur = latestPerTask.get(h.task);
        if (!cur || (h.created ?? '') > (cur.created ?? '')) latestPerTask.set(h.task, h);
      }

      const lines = [
        `# Project State — ${params.project}`,
        '',
        `**Tasks:** ${tasks.length} | **Handoffs:** ${handoffs.length}`,
        '',
        '| Task | Status | Current Stage | Blocked |',
        '|------|--------|---------------|---------|',
        ...tasks.map((t) => {
          const stage = latestPerTask.get(idFromPath(t.id))?.stage ?? '—';
          const blocked =
            t.status === 'blocked' || latestPerTask.get(idFromPath(t.id))?.status === 'failed';
          return `| ${idFromPath(t.id)} | ${t.status} | ${stage} | ${blocked ? '🔴' : ''} |`;
        }),
        '',
        `**Done:** ${tasks.filter((t) => t.status === 'done').length} | **Blocked:** ${tasks.filter((t) => t.status === 'blocked').length}`,
      ];
      return ok(lines.join('\n'), {
        project: params.project,
        tasks: tasks.length,
        handoffs: handoffs.length,
      });
    },
  });
}
