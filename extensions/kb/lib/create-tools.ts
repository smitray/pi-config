import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { err, ok } from '../../_shared/result';
import type { RegistryEntry } from './metadata';
import { buildPage } from './templates';
import {
  buildVaultPaths,
  DIR_NAMES,
  ensureVaultStructure,
  fmtDate,
  ID_PREFIXES,
  readJson,
  resolveVaultContext,
  slugify,
  writeJson,
} from './vault';

// ─── ID generation ──────────────────────────────────────────────
// ponytail: simple counter from existing files. Per-vault, per-type.
// Upgrade: store next-id in meta/registry.json when collisions matter.

function getNextId(vaultWiki: string, type: string): string {
  const prefix = ID_PREFIXES[type] ?? type.toUpperCase().slice(0, 4);
  const dir = DIR_NAMES[type] ?? `${type}s`;
  const typeDir = join(vaultWiki, dir);
  if (!existsSync(typeDir)) return `${prefix}-001`;

  const files = readdirSync(typeDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      // ponytail: filename is `${shortPrefix}-${ID}.md` (e.g. res-RES-001.md).
      // Match case-insensitive prefix + dash + digits at the end before .md.
      const m = f.match(/^[a-z]+-([A-Z]+-\d+)\.md$/i);
      return m ? parseInt(m[1].split('-')[1], 10) : 0;
    });
  const max = files.length > 0 ? Math.max(...files) : 0;
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

// ─── URL metadata auto-fetch ─────────────────────────────────────
// ponytail: parse og:title + meta description from raw HTML.
// No dependencies — fetch + regex. Upgrade: use a real HTML parser
// if parsing becomes unreliable.

// ─── Helpers ─────────────────────────────────────────────────────

function vaultFromCtx(cwd: string) {
  const { root } = resolveVaultContext(cwd);
  return buildVaultPaths(root);
}

function writePage(type: string, filename: string, content: string, cwd: string) {
  const paths = vaultFromCtx(cwd);
  const typeDir = join(paths.wiki, DIR_NAMES[type] ?? `${type}s`);
  if (!existsSync(typeDir)) mkdirSync(typeDir, { recursive: true });
  writeFileSync(join(typeDir, filename), content, 'utf-8');
  return { typeDir, filename, paths };
}

// ─── Deprecation shim ──────────────────────────────────────────
// v2: kb_create_* collapse into kb_ensure_page (type dispatch) or kb_scaffold.
// Deprecated tools still work for one release, with a console warning.
function deprecate(tool: string, replacement: string): void {
  console.warn(
    `[kb] ${tool} is deprecated — use ${replacement} instead. It will be removed in a future release.`
  );
}

// ─── kb_create_research ──────────────────────────────────────────

export function registerResearchTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: 'kb_create_research',
    label: 'KB Create Research (deprecated)',
    description:
      '[DEPRECATED] Track a research question through investigation. Records question, sources, findings, and confidence level. ' +
      'Replaced by kb_ensure_page type=research.',
    promptSnippet: 'Track a research question',
    promptGuidelines: [
      'Use kb_create_research to track deep research. Records question, findings, sources, and confidence.',
    ],
    parameters: Type.Object({
      title: Type.String({
        description: 'Research title (e.g. "Best state management for Svelte 5")',
      }),
      question: Type.String({ description: 'The specific research question being investigated' }),
      context: Type.Optional(
        Type.String({ description: 'Why this research matters — background or motivation' })
      ),
      status: Type.Optional(
        Type.String({
          description: 'Status: exploring | consolidating | complete',
          default: 'exploring',
        })
      ),
      confidence: Type.Optional(
        Type.String({
          description: 'Confidence: uncertain | partial | confident',
          default: 'uncertain',
        })
      ),
      tags: Type.Optional(Type.Array(Type.String(), { description: 'Tags for categorization' })),
      sources: Type.Optional(
        Type.Array(Type.String(), { description: 'Initial source URLs or KB references' })
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      deprecate('kb_create_research', 'kb_ensure_page type=research');
      const cwd = ctx.cwd ?? process.cwd();
      const paths = vaultFromCtx(cwd);
      const pageId = getNextId(paths.wiki, 'research');
      const sourceList = (params.sources ?? []).map((s) => `- ${s}`).join('\n');

      const { content, filename } = buildPage('research', params.title, paths, {
        id: pageId,
        question: params.question,
        status: params.status ?? 'exploring',
        confidence: params.confidence ?? 'uncertain',
        sources_count: String(params.sources?.length ?? 0),
        shared: 'false',
        stage: 'draft',
        tags: params.tags ?? [],
      });

      const body = [
        params.context ? `\n## Context\n\n${params.context}` : '',
        sourceList ? `\n## Sources\n\n${sourceList}` : '',
      ].join('\n');
      const fullContent = body ? `${content}\n${body}` : content;

      writePage('research', filename, fullContent, cwd);
      return ok(`✅ Research created [${pageId}] — ${params.title}`, {
        id: pageId,
        question: params.question,
      });
    },
  });
}

// ─── kb_create_plan ─────────────────────────────────────────────

// ─── Project management ──────────────────────────────────────────
// Root KB controls all project vaults. Each project vault lives in a git repo.
// Root stores: meta/projects.json + wiki/entities/ for project pages.
// Project vaults store: tickets, todos, artifacts, research (project-specific).
// Shared knowledge stays in root: libraries, plans, schedules, concepts.

interface ProjectEntry {
  id: string;
  name: string;
  path: string;
  description: string;
  status: string;
  created: string;
}

function getRootVaultPaths() {
  const home = process.env.KB_HOME ?? process.env.HOME ?? homedir();
  return buildVaultPaths(home);
}

// Walk up from cwd looking for .git/
function findGitRoot(cwd: string): string | null {
  let current = cwd;
  while (true) {
    if (existsSync(join(current, '.git'))) return current;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

// ─── kb_create_project ─────────────────────────────────────────

export function registerProjectTools(pi: ExtensionAPI): void {
  pi.registerTool({
    name: 'kb_create_project',
    label: 'KB Create Project (deprecated)',
    description:
      '[DEPRECATED] Create a new project vault in a git repo. Bootstrap .kb/ structure, ' +
      'register the project in the root KB inventory, and create a project page. ' +
      'Replaced by kb_scaffold. Run from inside a git repo.',
    promptSnippet: 'Create a new project vault',
    promptGuidelines: [
      'Use kb_create_project to create a new project vault in a git repo. Registers it in root KB.',
    ],
    parameters: Type.Object({
      name: Type.String({ description: 'Project name (e.g. "myapp", "dashboard-api")' }),
      description: Type.Optional(Type.String({ description: 'Short description of the project' })),
      status: Type.Optional(
        Type.String({ description: 'Status: active | paused | archived', default: 'active' })
      ),
      tags: Type.Optional(
        Type.Array(Type.String(), { description: 'Tags (e.g. frontend, backend, api)' })
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      deprecate('kb_create_project', 'kb_scaffold');
      const cwd = ctx.cwd ?? process.cwd();
      const projectRoot = findGitRoot(cwd);

      if (!projectRoot) {
        return err('NOT_GIT_REPO', 'Not in a git repo. Run from inside a git repository.');
      }

      const kbRoot = join(projectRoot, '.kb');
      if (existsSync(kbRoot)) {
        return err('ALREADY_EXISTS', `Project vault already exists at ${projectRoot}/.kb`);
      }

      // Bootstrap project vault using canonical ensureVaultStructure
      const paths = buildVaultPaths(projectRoot);
      ensureVaultStructure(paths);
      writeJson(join(kbRoot, 'config.json'), {
        topic: 'Project vault',
        mode: 'project',
        created: fmtDate(),
        version: '1.0',
      });

      // Register in root projects.json
      const rootVault = getRootVaultPaths();
      const projectsPath = join(rootVault.meta, 'projects.json');
      const projects: ProjectEntry[] = existsSync(projectsPath)
        ? (readJson(projectsPath) ?? [])
        : [];
      const projectId = `PROJ-${String(projects.length + 1).padStart(3, '0')}`;
      const entry: ProjectEntry = {
        id: projectId,
        name: params.name,
        path: projectRoot,
        description: params.description ?? '',
        status: params.status ?? 'active',
        created: fmtDate(),
      };
      projects.push(entry);
      writeJson(projectsPath, projects);

      // Create project page in root KB
      const tagList = (params.tags ?? []).map((t) => `"${t}"`).join(', ');
      const pageContent = [
        '---',
        `title: "${params.name}"`,
        'type: entity',
        'category: project',
        `id: "${projectId}"`,
        `status: ${params.status ?? 'active'}`,
        `tags: [${tagList}]`,
        `created: "${fmtDate()}"`,
        `updated: "${fmtDate()}"`,
        'stage: draft',
        `path: "${projectRoot}"`,
        '---',
        '',
        `# ${params.name}`,
        '',
        `**ID:** ${projectId}  |  **Status:** ${params.status ?? 'active'}  |  **Path:** \`${projectRoot}\``,
        '',
        '## Description',
        params.description ?? '',
        '',
        '## Active Tickets',
        '',
        '## Recent Activity',
        '',
        '## Notes',
      ].join('\n');

      const entityDir = join(rootVault.wiki, DIR_NAMES.entity);
      if (!existsSync(entityDir)) mkdirSync(entityDir, { recursive: true });
      writeFileSync(join(entityDir, `${slugify(params.name)}.md`), pageContent, 'utf-8');

      return ok(
        `✅ Project vault created at \`${projectRoot}/.kb/\`\n` +
          `Project [${projectId}] registered in root KB\n` +
          `Project page: \`wiki/${DIR_NAMES.entity}/${slugify(params.name)}.md\``,
        { id: projectId, name: params.name, path: projectRoot }
      );
    },
  });

  // ─── kb_list_projects ───────────────────────────────────────

  pi.registerTool({
    name: 'kb_list_projects',
    label: 'KB List Projects (deprecated)',
    description:
      '[DEPRECATED] List all project vaults registered in the root KB. ' +
      'Shows project ID, name, path, status, and description. Replaced by kb_status.',
    promptSnippet: 'List all projects',
    promptGuidelines: ['Use kb_list_projects to see all registered project vaults.'],
    parameters: Type.Object({}),
    async execute(_id, _params, _signal, _onUpdate, _ctx) {
      deprecate('kb_list_projects', 'kb_status');
      const rootVault = getRootVaultPaths();
      const projectsPath = join(rootVault.meta, 'projects.json');
      const projects: ProjectEntry[] = existsSync(projectsPath)
        ? (readJson(projectsPath) ?? [])
        : [];

      if (projects.length === 0) {
        return ok(
          'No projects registered yet. Run `kb_create_project` from a git repo to register a project.'
        );
      }

      const lines = [
        `## ${projects.length} Project(s)`,
        '',
        '| ID | Name | Path | Status | Description |',
        '|----|------|------|--------|-------------|',
        ...projects.map(
          (p) => `| ${p.id} | ${p.name} | \`${p.path}\` | ${p.status} | ${p.description || '-'} |`
        ),
        '',
        '_From root KB (`~/.kb/meta/projects.json`)_',
      ];

      return ok(lines.join('\n'), { count: projects.length, projects });
    },
  });
}

// ─── Pipeline tool registration functions ────────────────────────

export function registerProjectPageTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: 'kb_create_project_page',
    label: 'KB Create Project Page (deprecated)',
    description:
      '[DEPRECATED] Create the root project page (type: project) inside a project vault. ' +
      'This is the container for brainstorms, plans, specs, and tasks. Replaced by kb_ensure_page type=project.',
    promptSnippet: 'Create project root page',
    promptGuidelines: [
      'Use kb_create_project_page to create the root container for a project pipeline.',
    ],
    parameters: Type.Object({
      title: Type.String({ description: 'Project title (e.g. "Auth System Overhaul")' }),
      project_id: Type.Optional(
        Type.String({ description: 'Project ID (e.g. PROJ-001). Auto-generated if omitted.' })
      ),
      status: Type.Optional(
        Type.String({ description: 'Status: active | paused | archived', default: 'active' })
      ),
      priority: Type.Optional(
        Type.String({ description: 'Priority: critical | high | medium | low', default: 'medium' })
      ),
      owner: Type.Optional(Type.String({ description: 'Project owner' })),
      tags: Type.Optional(Type.Array(Type.String(), { description: 'Tags' })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      deprecate('kb_create_project_page', 'kb_ensure_page type=project');
      const cwd = ctx.cwd ?? process.cwd();
      const paths = vaultFromCtx(cwd);
      const pageId = params.project_id ?? getNextId(paths.wiki, 'project');

      const { content, filename } = buildPage('project', params.title, paths, {
        id: pageId,
        status: params.status ?? 'active',
        priority: params.priority ?? 'medium',
        owner: params.owner ?? '',
        brainstorm_status: 'seed',
        planning_status: 'draft',
        specs_total: '0',
        specs_done: '0',
        tasks_total: '0',
        tasks_done: '0',
        prs_total: '0',
        prs_merged: '0',
        progress_pct: '0',
        stage: 'draft',
        tags: params.tags ?? [],
      });

      writePage('project', filename, content, cwd);
      return ok(`✅ Project page created [${pageId}] — ${params.title}`, {
        id: pageId,
        path: `${DIR_NAMES.project}/${filename}`,
      });
    },
  });
}

export function registerBrainstormTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: 'kb_create_brainstorm',
    label: 'KB Create Brainstorm (deprecated)',
    description:
      '[DEPRECATED] Create a brainstorm page for raw ideas and iterative refinement. ' +
      'Links to parent project. Supports iteration tracking. Replaced by kb_ensure_page type=brainstorm.',
    promptSnippet: 'Create a brainstorm page',
    promptGuidelines: ['Use kb_create_brainstorm to capture and refine ideas for a project.'],
    parameters: Type.Object({
      title: Type.String({ description: 'Brainstorm title' }),
      project: Type.String({ description: 'Parent project ID (e.g. PROJ-001)' }),
      iteration: Type.Optional(
        Type.Integer({ description: 'Iteration number (1 for initial)', default: 1 })
      ),
      status: Type.Optional(
        Type.String({
          description: 'Status: seed | growing | refined | archived',
          default: 'seed',
        })
      ),
      tags: Type.Optional(Type.Array(Type.String(), { description: 'Tags' })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      deprecate('kb_create_brainstorm', 'kb_ensure_page type=brainstorm');
      const cwd = ctx.cwd ?? process.cwd();
      const paths = vaultFromCtx(cwd);
      const pageId = getNextId(paths.wiki, 'brainstorm');

      const { content, filename } = buildPage('brainstorm', params.title, paths, {
        id: pageId,
        project: params.project,
        iteration: String(params.iteration ?? 1),
        status: params.status ?? 'seed',
        maturity: 'low',
        next_iteration: String((params.iteration ?? 1) + 1),
        stage: 'brainstorm',
        tags: params.tags ?? [],
      });

      writePage('brainstorm', filename, content, cwd);
      return ok(`✅ Brainstorm created [${pageId}] — ${params.title}`, {
        id: pageId,
        project: params.project,
      });
    },
  });
}

export function registerSprintPlanTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: 'kb_create_sprint_plan',
    label: 'KB Create Sprint Plan',
    description: 'Create a sprint plan page. Links to parent project. Tracks child specs.',
    promptSnippet: 'Create a sprint plan',
    promptGuidelines: ['Use kb_create_sprint_plan to define sprint scope and track specs.'],
    parameters: Type.Object({
      title: Type.String({ description: 'Sprint plan title' }),
      project: Type.String({ description: 'Parent project ID' }),
      sprint: Type.Integer({ description: 'Sprint number' }),
      start_date: Type.Optional(Type.String({ description: 'Start date (YYYY-MM-DD)' })),
      end_date: Type.Optional(Type.String({ description: 'End date (YYYY-MM-DD)' })),
      status: Type.Optional(
        Type.String({ description: 'Status: draft | active | completed', default: 'draft' })
      ),
      tags: Type.Optional(Type.Array(Type.String(), { description: 'Tags' })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd ?? process.cwd();
      const paths = vaultFromCtx(cwd);
      const pageId = getNextId(paths.wiki, 'sprint-plan');

      const { content, filename } = buildPage('sprint-plan', params.title, paths, {
        id: pageId,
        project: params.project,
        sprint: String(params.sprint),
        start_date: params.start_date ?? '',
        end_date: params.end_date ?? '',
        status: params.status ?? 'draft',
        specs_total: '0',
        specs_done: '0',
        progress_pct: '0',
        stage: 'draft',
        tags: params.tags ?? [],
      });

      writePage('sprint-plan', filename, content, cwd);
      return ok(`✅ Sprint plan created [${pageId}] — ${params.title}`, {
        id: pageId,
        sprint: params.sprint,
      });
    },
  });
}

export function registerSpecTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: 'kb_create_spec',
    label: 'KB Create Spec',
    description:
      'Create a feature specification page. Links to parent sprint plan. Tracks child tasks.',
    promptSnippet: 'Create a feature spec',
    promptGuidelines: ['Use kb_create_spec to define a feature and track implementation tasks.'],
    parameters: Type.Object({
      title: Type.String({ description: 'Spec title' }),
      project: Type.String({ description: 'Project ID' }),
      sprint_plan: Type.String({ description: 'Parent sprint plan ID' }),
      feature: Type.String({ description: 'Feature name (e.g. jwt-auth)' }),
      status: Type.Optional(
        Type.String({
          description: 'Status: draft | review | approved | superseded',
          default: 'draft',
        })
      ),
      priority: Type.Optional(
        Type.String({ description: 'Priority: critical | high | medium | low', default: 'medium' })
      ),
      owner: Type.Optional(Type.String({ description: 'Spec owner' })),
      tags: Type.Optional(Type.Array(Type.String(), { description: 'Tags' })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd ?? process.cwd();
      const paths = vaultFromCtx(cwd);
      const pageId = getNextId(paths.wiki, 'spec');

      const { content, filename } = buildPage('spec', params.title, paths, {
        id: pageId,
        project: params.project,
        sprint_plan: params.sprint_plan,
        feature: params.feature,
        status: params.status ?? 'draft',
        priority: params.priority ?? 'medium',
        owner: params.owner ?? '',
        tasks_total: '0',
        tasks_done: '0',
        progress_pct: '0',
        review_checklist_passed: 'false',
        stage: 'draft',
        tags: params.tags ?? [],
      });

      writePage('spec', filename, content, cwd);
      return ok(`✅ Spec created [${pageId}] — ${params.title}`, {
        id: pageId,
        feature: params.feature,
      });
    },
  });
}

export function registerTaskTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: 'kb_create_task',
    label: 'KB Create Task',
    description:
      'Create an implementation task page. Links to parent spec. ' +
      'Has completion gate: tests_passing + review_approved + pr_linked must all be true for done.',
    promptSnippet: 'Create an implementation task',
    promptGuidelines: [
      'Use kb_create_task to define atomic work units. Status cannot move to done without completion gate.',
    ],
    parameters: Type.Object({
      title: Type.String({ description: 'Task title' }),
      project: Type.String({ description: 'Project ID' }),
      spec: Type.String({ description: 'Parent spec ID' }),
      sprint: Type.Optional(Type.Integer({ description: 'Sprint number' })),
      status: Type.Optional(
        Type.String({
          description: 'Status: backlog | ready | in_progress | blocked | review | done',
          default: 'backlog',
        })
      ),
      priority: Type.Optional(
        Type.String({ description: 'Priority: critical | high | medium | low', default: 'medium' })
      ),
      owner: Type.Optional(Type.String({ description: 'Task owner' })),
      estimate: Type.Optional(Type.String({ description: 'Time estimate (e.g. 4h)' })),
      tags: Type.Optional(Type.Array(Type.String(), { description: 'Tags' })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd ?? process.cwd();
      const paths = vaultFromCtx(cwd);
      const pageId = getNextId(paths.wiki, 'task');

      const { content, filename } = buildPage('task', params.title, paths, {
        id: pageId,
        project: params.project,
        spec: params.spec,
        sprint: String(params.sprint ?? ''),
        status: params.status ?? 'backlog',
        priority: params.priority ?? 'medium',
        owner: params.owner ?? '',
        estimate: params.estimate ?? '',
        actual: '',
        tests_passing: 'false',
        review_approved: 'false',
        pr_linked: '',
        stage: 'draft',
        tags: params.tags ?? [],
      });

      writePage('task', filename, content, cwd);
      return ok(`✅ Task created [${pageId}] — ${params.title}`, {
        id: pageId,
        spec: params.spec,
      });
    },
  });
}

// ─── kb_kanban ──────────────────────────────────────────────────

interface KanbanColumn {
  name: string;
  emoji: string;
  items: RegistryEntry[];
}

interface KanbanBoard {
  project: string;
  columns: KanbanColumn[];
  pipeline: {
    brainstorm: string;
    planning: string;
    specs_total: number;
    specs_done: number;
    tasks_total: number;
    tasks_done: number;
    prs_total: number;
    prs_merged: number;
    progress_pct: number;
  };
}

function renderKanbanMarkdown(board: KanbanBoard): string {
  const lines: string[] = [`# Kanban — ${board.project}`, ''];

  lines.push('## Pipeline Overview');
  lines.push('');
  lines.push('| Stage | Status | Progress |');
  lines.push('|-------|--------|----------|');
  lines.push(
    `| Brainstorm | ${board.pipeline.brainstorm === 'refined' ? '✅' : '🟡'} ${board.pipeline.brainstorm} | — |`
  );
  lines.push(
    `| Planning | ${board.pipeline.planning === 'completed' ? '✅' : '🟡'} ${board.pipeline.planning} | — |`
  );
  lines.push(
    `| Specs | ${board.pipeline.specs_done}/${board.pipeline.specs_total} | ${board.pipeline.specs_total > 0 ? Math.round((board.pipeline.specs_done / board.pipeline.specs_total) * 100) : 0}% |`
  );
  lines.push(
    `| Tasks | ${board.pipeline.tasks_done}/${board.pipeline.tasks_total} | ${board.pipeline.progress_pct}% |`
  );
  lines.push(
    `| PRs | ${board.pipeline.prs_merged}/${board.pipeline.prs_total} | ${board.pipeline.prs_total > 0 ? Math.round((board.pipeline.prs_merged / board.pipeline.prs_total) * 100) : 0}% |`
  );
  lines.push(`| **Overall** | **in_progress** | **${board.pipeline.progress_pct}%** |`);
  lines.push('');

  lines.push('## Task Board');
  lines.push('');

  for (const col of board.columns) {
    if (col.items.length === 0) continue;
    lines.push(`### ${col.emoji} ${col.name} (${col.items.length})`);
    for (const item of col.items) {
      const priority = item.priority ? ` | ${item.priority}` : '';
      const owner = item.owner ? ` | @${item.owner}` : '';
      const blocked = item.status === 'blocked' ? ' ↳ check notes' : '';
      const pr = item.pr_linked ? ` ↳ PR: ${item.pr_linked}` : '';
      lines.push(`- [[${item.title}]]${priority}${owner}${blocked}${pr}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function registerKanbanTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: 'kb_kanban',
    label: 'KB Kanban Board',
    description:
      'Generate Kanban board view for a project. Shows task pipeline, spec progress, ' +
      'and overall project status. Reads from registry.json.',
    promptSnippet: 'Show project Kanban board',
    promptGuidelines: [
      'Use kb_kanban to visualize project progress. Shows tasks grouped by status column.',
    ],
    parameters: Type.Object({
      project: Type.String({ description: 'Project ID (e.g. PROJ-001)' }),
      format: Type.Optional(
        Type.String({ description: 'Output format: markdown | json', default: 'markdown' })
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd ?? process.cwd();
      const paths = vaultFromCtx(cwd);
      const registryPath = join(paths.meta, 'registry.json');

      if (!existsSync(registryPath)) {
        return err('NO_REGISTRY', 'Registry not found. Run kb_rebuild_meta first.');
      }

      const registry: RegistryEntry[] = readJson(registryPath) ?? [];

      const projectPages = registry.filter(
        (p) => p.project === params.project || p.id.includes(params.project)
      );

      if (projectPages.length === 0) {
        return err('NO_PROJECT', `No pages found for project ${params.project}`);
      }

      const tasks = projectPages.filter((p) => p.type === 'task');
      const specs = projectPages.filter((p) => p.type === 'spec');
      const plans = projectPages.filter((p) => p.type === 'sprint-plan');
      const brainstorms = projectPages.filter((p) => p.type === 'brainstorm');
      const prs = projectPages.filter((p) => p.type === 'pr');

      const columns: KanbanColumn[] = [
        { name: 'Backlog', emoji: '📋', items: tasks.filter((t) => t.status === 'backlog') },
        { name: 'Ready', emoji: '🟢', items: tasks.filter((t) => t.status === 'ready') },
        {
          name: 'In Progress',
          emoji: '🔵',
          items: tasks.filter((t) => t.status === 'in_progress'),
        },
        { name: 'Blocked', emoji: '🔴', items: tasks.filter((t) => t.status === 'blocked') },
        { name: 'Review', emoji: '👀', items: tasks.filter((t) => t.status === 'review') },
        { name: 'Done', emoji: '✅', items: tasks.filter((t) => t.status === 'done') },
      ];

      const tasksTotal = tasks.length;
      const tasksDone = tasks.filter((t) => t.status === 'done').length;
      const pipeline = {
        brainstorm: brainstorms.some((b) => b.status === 'refined')
          ? 'refined'
          : brainstorms.some((b) => b.status === 'growing')
            ? 'growing'
            : 'seed',
        planning: plans.some((p) => p.status === 'active')
          ? 'active'
          : plans.every((p) => p.status === 'completed')
            ? 'completed'
            : 'draft',
        specs_total: specs.length,
        specs_done: specs.filter((s) => s.status === 'approved').length,
        tasks_total: tasksTotal,
        tasks_done: tasksDone,
        prs_total: prs.length,
        prs_merged: prs.filter((p) => p.status === 'merged').length,
        progress_pct: tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0,
      };

      const board: KanbanBoard = {
        project: params.project,
        columns,
        pipeline,
      };

      if (params.format === 'json') {
        return ok(JSON.stringify(board, null, 2), board as unknown as Record<string, unknown>);
      }

      return ok(renderKanbanMarkdown(board), board as unknown as Record<string, unknown>);
    },
  });
}
