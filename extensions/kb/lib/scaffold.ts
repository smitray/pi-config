import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { ok } from '../../_shared/result';
import { writeAllRoles } from './roles';
import { writeDefaultTemplates } from './templates';
import { buildVaultPaths, ensureVaultStructure, fmtDate, type VaultPaths } from './vault';

const EXT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

export interface ScaffoldOptions {
  topic: string;
  mode: 'personal' | 'project';
  root: string;
  issueTracker?: 'github' | 'linear' | 'local' | 'none';
  firstAdrTitle?: string;
}

/** Write the canonical CONTEXT.md page (type: context). Idempotent. */
function ensureContextPage(paths: VaultPaths, topic: string): string {
  const dir = join(paths.wiki, 'context');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const file = join(dir, 'context.md');
  if (existsSync(file)) return file;
  const content = [
    '---',
    `title: "Project Context"`,
    'type: context',
    'stage: draft',
    'tags: ["context"]',
    `created: "${fmtDate()}"`,
    `updated: "${fmtDate()}"`,
    '---',
    '',
    `# Project Context — ${topic}`,
    '',
    '## Purpose',
    '',
    '## Ubiquitous Language',
    '',
    '| Term | Meaning |',
    '|------|---------|',
    '|      |         |',
    '',
    '## Domain Boundaries',
    '',
    '## Constraints',
    '',
  ].join('\n');
  writeFileSync(file, content, 'utf-8');
  return file;
}

/** Write the local flow router skill. Idempotent. */
function ensureFlowSkill(paths: VaultPaths): string {
  const skillDir = join(paths.dotKb, '..', 'skills', 'kb-flow');
  const file = join(skillDir, 'SKILL.md');
  if (existsSync(file)) return file;
  mkdirSync(skillDir, { recursive: true });
  const src = join(EXT_DIR, 'skills', 'kb-flow', 'SKILL.md');
  if (existsSync(src)) {
    writeFileSync(file, readFileSync(src, 'utf-8'), 'utf-8');
    return file;
  }
  writeFileSync(
    file,
    [
      '---',
      'name: kb-flow',
      'description: Local flow router — walk the 12 kb flows via kb_flow, record handoffs per stage.',
      '---',
      '',
      '# KB Flow',
      '',
      'Use `kb_flow` to start/advance/loop-back/complete a named flow. Each stage emits a handoff.',
    ].join('\n'),
    'utf-8'
  );
  return file;
}

/** Write the .kb/AGENTS.md quick reference. Idempotent. */
function ensureAgentsMd(paths: VaultPaths, topic: string, mode: string): string {
  const file = join(paths.dotKb, 'AGENTS.md');
  if (existsSync(file)) return file;
  const content = [
    `# ${topic} — KB Quick Reference`,
    '',
    `Vault: \`.kb/\` (${mode} mode)`,
    '',
    '## Rules',
    '',
    '- `raw/` is immutable — only `kb_capture` writes there.',
    '- `wiki/` is write-restricted — only typed tools (`kb_ensure_page`, `kb_create_*`, `kb_flow`) write pages.',
    '- `meta/` is auto-generated — never edit by hand.',
    '- Handoffs are the audit trail: record one per stage via `kb_create_handoff`.',
    '',
    '## Page types',
    '',
    'concept, entity, synthesis, analysis, source, research, context, adr, handoff, project, library-doc, daily-log, brainstorm, sprint-plan, spec, task',
    '',
    '## Roles',
    '',
    'orchestrator, designer, implementer, reviewer, researcher, diagnoser, onboarder, architect, writer — see `wiki/agents/`',
    '',
    '## Lint',
    '',
    'Run `kb_lint` after ingest or periodically; `kb_lint strict=true` fails on any warning.',
    '',
  ].join('\n');
  writeFileSync(file, content, 'utf-8');
  return file;
}

/** Write repo-root AGENTS.md importing the kb config (unless one exists). */
function ensureRootAgentsMd(root: string): string | null {
  const file = join(root, 'AGENTS.md');
  if (existsSync(file)) return null; // never touch an existing AGENTS.md
  const content = [
    '# Agent Instructions',
    '',
    'This project uses the KB extension. See `@.kb/AGENTS.md` for the knowledge base quick reference.',
    '',
  ].join('\n');
  writeFileSync(file, content, 'utf-8');
  return file;
}

/** Write the first ADR (vault page + repo mirror). */
function ensureFirstAdr(
  paths: VaultPaths,
  root: string,
  title: string
): { vault: string; repo: string | null } {
  const adrId = 'ADR-001';
  const dir = join(paths.wiki, 'adrs');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const vaultFile = join(dir, `adr-${adrId}.md`);
  if (!existsSync(vaultFile)) {
    const content = [
      '---',
      `title: "${title}"`,
      'type: adr',
      `id: "${adrId}"`,
      'status: accepted',
      'stage: production',
      'tags: ["decision"]',
      `decided: "${fmtDate()}"`,
      `created: "${fmtDate()}"`,
      `updated: "${fmtDate()}"`,
      'superseded_by: ""',
      '---',
      '',
      `# ${title}`,
      '',
      '## Decision',
      '',
      'This project uses the KB extension (three-layer knowledge book: raw / wiki / meta).',
      '',
      '## Context',
      '',
      '## Alternatives Considered',
      '',
      '## Consequences',
      '',
      '## Supersedes',
      '',
      '## Sources',
      '',
    ].join('\n');
    writeFileSync(vaultFile, content, 'utf-8');
  }

  // Optional repo mirror: docs/adr/0001-*.md
  const docsDir = join(root, 'docs', 'adr');
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const repoFile = join(docsDir, `0001-${slug}.md`);
  if (!existsSync(repoFile)) {
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(
      repoFile,
      `# ${adrId} — ${title}\n\n> Mirror of \`.kb/wiki/adrs/adr-${adrId}.md\`. Vault is canonical.\n\nStatus: accepted (${fmtDate()})\n`,
      'utf-8'
    );
    return { vault: vaultFile, repo: repoFile };
  }
  return { vault: vaultFile, repo: null };
}

export function scaffoldProject(opts: ScaffoldOptions): Record<string, string> {
  const paths = buildVaultPaths(opts.root);
  ensureVaultStructure(paths);

  const created: Record<string, string> = {};

  // config.json (only if missing)
  const configPath = join(paths.dotKb, 'config.json');
  if (!existsSync(configPath)) {
    writeFileSync(
      configPath,
      JSON.stringify(
        {
          topic: opts.topic,
          mode: opts.mode,
          created: fmtDate(),
          version: '2.0',
          issueTracker: opts.issueTracker ?? 'local',
          pageTypes: 16,
        },
        null,
        2
      ),
      'utf-8'
    );
    created.config = configPath;
  }

  writeDefaultTemplates(paths, opts.mode);
  created.context = ensureContextPage(paths, opts.topic);
  created.agents =
    writeAllRoles(paths).length > 0 ? join(paths.wiki, 'agents', 'role-orchestrator.md') : '';
  created.flowSkill = ensureFlowSkill(paths);
  created.kbAgents = ensureAgentsMd(paths, opts.topic, opts.mode);
  const adr = ensureFirstAdr(paths, opts.root, opts.firstAdrTitle ?? 'Use KB extension');
  created.adr = adr.vault;
  if (adr.repo) created.adrMirror = adr.repo;

  if (opts.mode === 'project') {
    const rootAgents = ensureRootAgentsMd(opts.root);
    if (rootAgents) created.rootAgents = rootAgents;
  }

  return created;
}

// ─── Tool ───────────────────────────────────────────────────────

export function registerScaffoldTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: 'kb_scaffold',
    label: 'KB Scaffold',
    description:
      'One-time full project bootstrap: vault structure, 16 templates, CONTEXT page, 9 role pages, ' +
      'role registry, local flow skill, .kb/AGENTS.md, seed ADR. Idempotent — never deletes user files.',
    promptSnippet: 'Scaffold a complete KB project',
    promptGuidelines: [
      'Use kb_scaffold to bootstrap a new project with the full kb setup. Prefer over kb_bootstrap for new projects.',
    ],
    parameters: Type.Object({
      topic: Type.String({ description: 'Main topic of this knowledge base' }),
      mode: Type.Optional(
        Type.String({ description: 'Vault mode: personal or project (default: project)' })
      ),
      root: Type.Optional(Type.String({ description: 'Root directory (default: cwd)' })),
      issue_tracker: Type.Optional(
        Type.String({ description: 'Issue tracker: github | linear | local | none' })
      ),
      first_adr_title: Type.Optional(
        Type.String({ description: 'Title of the seed ADR (default: "Use KB extension")' })
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const root = params.root ?? ctx.cwd ?? process.cwd();
      const mode = (params.mode ?? 'project') as 'personal' | 'project';

      // Ask the 4 scaffold questions when UI is available and answers aren't supplied.
      let issueTracker = params.issue_tracker as ScaffoldOptions['issueTracker'];
      let firstAdrTitle = params.first_adr_title;
      if (ctx.hasUI && !issueTracker) {
        const choice = await ctx.ui.select('Issue tracker?', [
          'local — none, track in KB tasks',
          'github',
          'linear',
          'none',
        ]);
        if (choice)
          issueTracker = choice.includes('github')
            ? 'github'
            : choice.includes('linear')
              ? 'linear'
              : choice.includes('none')
                ? 'none'
                : 'local';
      }
      if (ctx.hasUI && !firstAdrTitle) {
        const input = await ctx.ui.input('Seed ADR title? (first architecture decision)');
        if (input) firstAdrTitle = input;
      }

      const created = scaffoldProject({
        topic: params.topic,
        mode,
        root,
        issueTracker,
        firstAdrTitle,
      });

      const lines = [
        `# 🏗️ KB Scaffolded — ${params.topic}`,
        '',
        `**Mode:** ${mode} | **Root:** ${root}`,
        '',
        '## Created',
        '',
        ...Object.entries(created).map(([k, v]) => `- **${k}:** \`${v}\``),
        '',
        'Idempotent — existing files were left untouched.',
      ];
      return ok(lines.join('\n'), { mode, root, created });
    },
  });
}
