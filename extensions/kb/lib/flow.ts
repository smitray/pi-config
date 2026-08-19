import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { err, ok } from '../../_shared/result';
import { createHandoff } from './handoffs';
import { buildVaultPaths, readJson, resolveVaultContext, type VaultPaths } from './vault';

// ─── The twelve flows ───────────────────────────────────────────
// Each flow is a fixed graph of stages. The pre-stage varies; the tail
// is always the same shape — record handoff, update wiki, log event.

export type FlowArchetype = 'acquisition' | 'application' | 'audit' | 'transfer';

export interface FlowDef {
  id: number;
  name: string;
  archetype: FlowArchetype;
  stages: string[];
  produces: string;
}

export const FLOWS: FlowDef[] = [
  {
    id: 1,
    name: 'build',
    archetype: 'application',
    stages: ['brief', 'design', 'execute', 'test', 'commit'],
    produces: 'Code changes, validated',
  },
  {
    id: 2,
    name: 'research',
    archetype: 'application',
    stages: ['research', 'execute', 'test', 'commit'],
    produces: 'Code changes, validated',
  },
  {
    id: 3,
    name: 'design',
    archetype: 'application',
    stages: ['design', 'execute', 'test', 'commit'],
    produces: 'Code changes, validated',
  },
  {
    id: 4,
    name: 'diff-review',
    archetype: 'audit',
    stages: ['code-review', 'commit'],
    produces: 'Findings, recommendations',
  },
  {
    id: 5,
    name: 'architecture-review',
    archetype: 'audit',
    stages: ['architecture-review', 'commit'],
    produces: 'Findings, recommendations',
  },
  {
    id: 6,
    name: 'pr-triage',
    archetype: 'audit',
    stages: ['security-gate', 'merge'],
    produces: 'Merge decision',
  },
  {
    id: 7,
    name: 'greenfield',
    archetype: 'acquisition',
    stages: ['brainstorm', 'research', 'acquire', 'update-kb'],
    produces: 'Wiki pages, no code',
  },
  {
    id: 8,
    name: 'retry-after-failure',
    archetype: 'application',
    stages: ['diagnose', 'research', 're-execute', 're-test'],
    produces: 'Recovered execution',
  },
  {
    id: 9,
    name: 'onboarding',
    archetype: 'acquisition',
    stages: ['read-context', 'identify-gaps', 'research-gaps', 'update-kb'],
    produces: 'Wiki pages, no code',
  },
  {
    id: 10,
    name: 'maintenance',
    archetype: 'audit',
    stages: ['lint', 'resolve', 'archive'],
    produces: 'Health report',
  },
  {
    id: 11,
    name: 'decision-logging',
    archetype: 'acquisition',
    stages: ['capture-decision', 'link-sources'],
    produces: 'ADR page',
  },
  {
    id: 12,
    name: 'session-handoff',
    archetype: 'transfer',
    stages: ['summarize', 'write-handoff', 'log'],
    produces: 'Handoff pages, continuity',
  },
];

export function getFlow(name: string): FlowDef | undefined {
  return FLOWS.find((f) => f.name === name);
}

// ─── Run state ──────────────────────────────────────────────────
// ponytail: flow state is a single JSON file in meta/. The audit trail
// (handoffs) is the durable record; this file is just the cursor.

export interface FlowRun {
  runId: string;
  flow: string;
  project: string;
  task?: string;
  currentIndex: number;
  status: 'in_progress' | 'done';
  handoffIds: string[];
  started_at: string;
  completed_at?: string;
}

function runsPath(paths: VaultPaths): string {
  return join(paths.meta, 'flow-runs.json');
}

export function loadRuns(paths: VaultPaths): FlowRun[] {
  return readJson<FlowRun[]>(runsPath(paths)) ?? [];
}

function saveRuns(paths: VaultPaths, runs: FlowRun[]): void {
  writeFileSync(runsPath(paths), JSON.stringify(runs, null, 2), 'utf-8');
}

export function newRunId(paths: VaultPaths): string {
  const today = new Date().toISOString().split('T')[0].replaceAll('-', '');
  const runs = loadRuns(paths).filter((r) => r.runId.includes(today));
  return `RUN-${today}-${String(runs.length + 1).padStart(3, '0')}`;
}

export function getActiveRun(
  paths: VaultPaths,
  project: string,
  task?: string
): FlowRun | undefined {
  return loadRuns(paths).find(
    (r) => r.status === 'in_progress' && r.project === project && (task ? r.task === task : true)
  );
}

export function startFlow(
  paths: VaultPaths,
  flow: string,
  project: string,
  task?: string,
  summary?: string
): { run: FlowRun; handoffId: string } | { error: string } {
  const def = getFlow(flow);
  if (!def)
    return { error: `Unknown flow: ${flow}. Known: ${FLOWS.map((f) => f.name).join(', ')}` };
  if (getActiveRun(paths, project, task))
    return {
      error: 'An active run already exists for this project/task. Advance it or complete it first.',
    };

  const runs = loadRuns(paths);
  const runId = newRunId(paths);
  const { id: handoffId } = createHandoff(paths, {
    stage: def.stages[0],
    task,
    project,
    status: 'in-progress',
    summary: summary ?? `Start ${flow} flow — stage: ${def.stages[0]}`,
    run: runId,
  });
  const run: FlowRun = {
    runId,
    flow,
    project,
    task,
    currentIndex: 0,
    status: 'in_progress',
    handoffIds: [handoffId],
    started_at: new Date().toISOString(),
  };
  runs.push(run);
  saveRuns(paths, runs);
  return { run, handoffId };
}

export function advanceFlow(
  paths: VaultPaths,
  runId: string,
  summary?: string
): { run: FlowRun; handoffId?: string; finished?: boolean } | { error: string } {
  const runs = loadRuns(paths);
  const run = runs.find((r) => r.runId === runId);
  if (!run) return { error: `No run found: ${runId}` };
  const def = getFlow(run.flow);
  if (!def) return { error: `Unknown flow: ${run.flow}` };

  const next = run.currentIndex + 1;
  if (next >= def.stages.length) {
    run.status = 'done';
    run.completed_at = new Date().toISOString();
    saveRuns(paths, runs);
    return { run, finished: true };
  }
  run.currentIndex = next;
  const { id: handoffId } = createHandoff(paths, {
    stage: def.stages[next],
    task: run.task,
    project: run.project,
    status: 'in-progress',
    summary: summary ?? `Advance to stage: ${def.stages[next]}`,
    run: runId,
  });
  run.handoffIds.push(handoffId);
  saveRuns(paths, runs);
  return { run, handoffId };
}

export function loopBackFlow(
  paths: VaultPaths,
  runId: string,
  targetStage: string,
  reason: string
): { run: FlowRun; handoffId: string } | { error: string } {
  const runs = loadRuns(paths);
  const run = runs.find((r) => r.runId === runId);
  if (!run) return { error: `No run found: ${runId}` };
  const def = getFlow(run.flow);
  if (!def) return { error: `Unknown flow: ${run.flow}` };

  const idx = def.stages.indexOf(targetStage);
  if (idx === -1) return { error: `Stage "${targetStage}" not in flow ${run.flow}` };

  const { id: handoffId } = createHandoff(paths, {
    stage: 'loop-back',
    task: run.task,
    project: run.project,
    status: 'failed',
    summary: `Loop back to "${targetStage}": ${reason}`,
    run: runId,
    body: `## Failure notes\n\n${reason}\n\nRe-entering stage: **${targetStage}**.`,
  });
  run.currentIndex = idx;
  run.handoffIds.push(handoffId);
  saveRuns(paths, runs);
  return { run, handoffId };
}

export function completeFlow(
  paths: VaultPaths,
  runId: string
): { run: FlowRun } | { error: string } {
  const runs = loadRuns(paths);
  const run = runs.find((r) => r.runId === runId);
  if (!run) return { error: `No run found: ${runId}` };
  run.status = 'done';
  run.completed_at = new Date().toISOString();
  saveRuns(paths, runs);
  return { run };
}

export function flowStatusText(run: FlowRun): string {
  const def = getFlow(run.flow);
  const lines = [
    `# Flow Run — ${run.runId}`,
    '',
    `**Flow:** ${run.flow} (${def?.archetype ?? '?'}) | **Project:** ${run.project}${run.task ? ` | **Task:** ${run.task}` : ''}`,
    `**Status:** ${run.status} | **Stage:** ${def ? `${run.currentIndex + 1}/${def.stages.length} (${def.stages[run.currentIndex]})` : '?'}`,
    '',
    '## Stages',
    '',
    ...(def?.stages ?? []).map(
      (s, i) => `${i < run.currentIndex ? '✅' : i === run.currentIndex ? '🔵' : '⬜'} ${s}`
    ),
    '',
    `**Handoffs:** ${run.handoffIds.join(', ')}`,
  ];
  return lines.join('\n');
}

// ─── Tool ───────────────────────────────────────────────────────

export function registerFlowTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: 'kb_flow',
    label: 'KB Flow',
    description:
      'State machine over 12 named flows (build, research, design, diff-review, architecture-review, ' +
      'pr-triage, greenfield, retry-after-failure, onboarding, maintenance, decision-logging, session-handoff). ' +
      'Actions: start, advance, loop_back, status, complete. Each stage emits a handoff into the task chain.',
    promptSnippet: 'Run a flow state machine',
    promptGuidelines: [
      'Use kb_flow to walk a named flow: start the flow, advance stage by stage, loop back on failure, complete when done.',
    ],
    parameters: Type.Object({
      action: Type.String({
        description: 'start | advance | loop_back | status | complete',
      }),
      flow: Type.Optional(Type.String({ description: 'Flow name (required for start)' })),
      project: Type.Optional(Type.String({ description: 'Project ID (e.g. PROJ-001)' })),
      task: Type.Optional(Type.String({ description: 'Task ID (e.g. TASK-001)' })),
      run: Type.Optional(
        Type.String({ description: 'Run ID (required for advance/loop_back/status/complete)' })
      ),
      summary: Type.Optional(Type.String({ description: 'Stage summary for the handoff' })),
      target_stage: Type.Optional(
        Type.String({ description: 'Stage to re-enter (loop_back only)' })
      ),
      reason: Type.Optional(Type.String({ description: 'Failure reason (loop_back only)' })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd ?? process.cwd();
      const { root } = resolveVaultContext(cwd);
      const paths = buildVaultPaths(root);
      if (!existsSync(join(paths.dotKb, 'config.json'))) {
        return err('NO_VAULT', 'No KB vault found. Run `kb_bootstrap` first.');
      }

      const action = params.action;
      if (action === 'start') {
        if (!params.flow || !params.project) {
          return err('MISSING_PARAMS', 'start requires flow=<name> and project=<PROJ-ID>.');
        }
        const res = startFlow(paths, params.flow, params.project, params.task, params.summary);
        if ('error' in res) return err('FLOW_ERROR', res.error);
        return ok(`✅ Flow started: ${res.run.runId}\n\n${flowStatusText(res.run)}`, {
          runId: res.run.runId,
          handoffId: res.handoffId,
        });
      }

      const runId = params.run;
      if (!runId) return err('MISSING_PARAMS', `${action} requires run=<RUN-ID>.`);
      const run = loadRuns(paths).find((r) => r.runId === runId);
      if (!run) return err('NO_RUN', `No run found: ${runId}`);

      if (action === 'advance') {
        const res = advanceFlow(paths, runId, params.summary);
        if ('error' in res) return err('FLOW_ERROR', res.error);
        if (res.finished) {
          return ok(`🏁 Flow complete: ${runId}\n\n${flowStatusText(res.run)}`, {
            runId,
            finished: true,
          });
        }
        return ok(`✅ Advanced: ${runId}\n\n${flowStatusText(res.run)}`, {
          runId,
          handoffId: res.handoffId,
        });
      }

      if (action === 'loop_back') {
        if (!params.target_stage || !params.reason) {
          return err('MISSING_PARAMS', 'loop_back requires target_stage and reason.');
        }
        const res = loopBackFlow(paths, runId, params.target_stage, params.reason);
        if ('error' in res) return err('FLOW_ERROR', res.error);
        return ok(`🔁 Loop back recorded: ${runId}\n\n${flowStatusText(res.run)}`, {
          runId,
          handoffId: res.handoffId,
        });
      }

      if (action === 'complete') {
        const res = completeFlow(paths, runId);
        if ('error' in res) return err('FLOW_ERROR', res.error);
        return ok(`🏁 Flow completed: ${runId}`, { runId, status: res.run.status });
      }

      if (action === 'status') {
        return ok(flowStatusText(run), { runId, status: run.status, stage: run.currentIndex });
      }

      return err(
        'BAD_ACTION',
        `Unknown action: ${action}. Use start | advance | loop_back | status | complete.`
      );
    },
  });
}
