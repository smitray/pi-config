import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { err, ok } from '../../_shared/result';
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
      const m = f.match(/^([A-Z]+)-(\d+)/);
      return m ? parseInt(m[2], 10) : 0;
    });
  const max = files.length > 0 ? Math.max(...files) : 0;
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

// ─── URL metadata auto-fetch ─────────────────────────────────────
// ponytail: parse og:title + meta description from raw HTML.
// No dependencies — fetch + regex. Upgrade: use a real HTML parser
// if parsing becomes unreliable.

interface UrlMetadata {
  title: string;
  description: string;
  platform: string;
}

function detectPlatform(url: string): string {
  try {
    const host = new URL(url).hostname.replace('www.', '');
    if (host.includes('youtube') || host.includes('youtu.be')) return 'youtube';
    if (host.includes('github')) return 'github';
    if (host.includes('twitter') || host.includes('x.com')) return 'twitter';
    if (host.includes('instagram')) return 'instagram';
    if (host.includes('linkedin')) return 'linkedin';
    if (host.includes('stackoverflow')) return 'stackoverflow';
    if (host.includes('npmjs')) return 'npm';
    if (host.includes('pypi')) return 'pypi';
    if (host.includes('crates.io')) return 'crates';
    if (host.includes('dev.to')) return 'devto';
    if (host.includes('medium')) return 'medium';
    if (host.includes('reddit')) return 'reddit';
    if (host.includes('mastodon')) return 'mastodon';
    return 'web';
  } catch {
    return 'web';
  }
}

async function fetchUrlMetadata(url: string): Promise<UrlMetadata> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; pi-kb/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { title: url, description: '', platform: detectPlatform(url) };

    const html = await res.text();
    const title =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ??
      url;
    const description =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      '';
    return { title: title.trim(), description: description.trim(), platform: detectPlatform(url) };
  } catch {
    return { title: url, description: '', platform: detectPlatform(url) };
  }
}

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

// ─── kb_create_schedule ──────────────────────────────────────────

export function registerScheduleTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: 'kb_create_schedule',
    label: 'KB Create Schedule',
    description:
      'Create a daily time-blocked schedule page with morning, deep work, and afternoon blocks.',
    promptSnippet: 'Create a daily schedule',
    promptGuidelines: [
      'Use kb_create_schedule to plan a day. Generates SCHED-XXX ID, time blocks, and sub-agent assignments.',
    ],
    parameters: Type.Object({
      title: Type.String({ description: 'Schedule title (e.g. "2025-07-17 — Day 14")' }),
      theme: Type.Optional(Type.String({ description: 'Daily theme or focus area' })),
      morning_time: Type.Optional(
        Type.String({ description: 'Morning block time (e.g. "09:00-11:00")' })
      ),
      morning_focus: Type.Optional(Type.String({ description: 'Morning focus task' })),
      morning_agent: Type.Optional(
        Type.String({ description: 'Sub-agent for morning block (e.g. Researcher)' })
      ),
      deepwork_time: Type.Optional(
        Type.String({ description: 'Deep work block time (e.g. "11:00-14:00")' })
      ),
      deepwork_focus: Type.Optional(Type.String({ description: 'Deep work task' })),
      deepwork_agent: Type.Optional(Type.String({ description: 'Sub-agent for deep work block' })),
      afternoon_time: Type.Optional(
        Type.String({ description: 'Afternoon block time (e.g. "15:00-17:00")' })
      ),
      afternoon_focus: Type.Optional(Type.String({ description: 'Afternoon focus task' })),
      afternoon_agent: Type.Optional(Type.String({ description: 'Sub-agent for afternoon block' })),
      wrap_time: Type.Optional(
        Type.String({ description: 'Review & wrap time (e.g. "17:00-17:30")' })
      ),
      day_number: Type.Optional(Type.Integer({ description: 'Day number (e.g. 14)' })),
      week: Type.Optional(Type.String({ description: 'Week identifier (e.g. "W28")' })),
      energy: Type.Optional(
        Type.String({ description: 'Starting energy: high | medium | low', default: 'medium' })
      ),
      tags: Type.Optional(Type.Array(Type.String(), { description: 'Tags for categorization' })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd ?? process.cwd();
      const paths = vaultFromCtx(cwd);
      const pageId = getNextId(paths.wiki, 'schedule');
      const today = fmtDate();

      const { content, filename } = buildPage('schedule', params.title, paths, {
        id: pageId,
        date: today,
        theme: params.theme ?? '',
        morning_time: params.morning_time ?? '',
        morning_focus: params.morning_focus ?? '',
        morning_status: 'pending',
        morning_agent: params.morning_agent ?? '',
        deepwork_time: params.deepwork_time ?? '',
        deepwork_focus: params.deepwork_focus ?? '',
        deepwork_status: 'pending',
        deepwork_agent: params.deepwork_agent ?? '',
        afternoon_time: params.afternoon_time ?? '',
        afternoon_focus: params.afternoon_focus ?? '',
        afternoon_status: 'pending',
        afternoon_agent: params.afternoon_agent ?? '',
        wrap_time: params.wrap_time ?? '',
        day_number: String(params.day_number ?? 1),
        week: params.week ?? '',
        energy: params.energy ?? 'medium',
        stage: 'draft',
        tags: params.tags ?? [],
      });

      writePage('schedule', filename, content, cwd);
      return ok(`✅ Schedule created \`${DIR_NAMES.schedule}/${filename}\` [${pageId}]`, {
        id: pageId,
        path: `${DIR_NAMES.schedule}/${filename}`,
      });
    },
  });
}

// ─── kb_create_library ──────────────────────────────────────────

export function registerLibraryTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: 'kb_create_library',
    label: 'KB Create Library Entry',
    description:
      'Create a library entry for a web resource. Auto-fetches title and description from URL. ' +
      'Use for bookmarks, documentation, tutorials, and research resources.',
    promptSnippet: 'Add a resource to the KB library',
    promptGuidelines: [
      'Use kb_create_library to save a web resource. Auto-fetches metadata from the URL.',
    ],
    parameters: Type.Object({
      url: Type.String({ description: 'URL of the resource' }),
      title: Type.Optional(
        Type.String({ description: 'Title (auto-fetched from URL if omitted)' })
      ),
      topic: Type.Optional(
        Type.String({ description: 'Topic or category (e.g. "react", "rust", "architecture")' })
      ),
      source_type: Type.Optional(
        Type.String({
          description:
            'Source type: documentation | tutorial | blog | video | paper | tool | book | other',
          default: 'other',
        })
      ),
      priority: Type.Optional(
        Type.String({ description: 'Priority: high | medium | low', default: 'medium' })
      ),
      tags: Type.Optional(Type.Array(Type.String(), { description: 'Tags for categorization' })),
      notes: Type.Optional(Type.String({ description: 'Personal notes or why this was saved' })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd ?? process.cwd();
      const paths = vaultFromCtx(cwd);
      const pageId = getNextId(paths.wiki, 'library');

      // Fetch once, destructure
      const meta = await fetchUrlMetadata(params.url);
      const title = params.title ?? meta.title;

      const { content, filename } = buildPage('library', title, paths, {
        id: pageId,
        url: params.url,
        topic: params.topic ?? '',
        source_type: params.source_type ?? 'other',
        platform: meta.platform,
        captured: fmtDate(),
        status: 'unread',
        priority: params.priority ?? 'medium',
        reviewed: 'false',
        shared: 'false',
        stage: 'draft',
        tags: params.tags ?? [],
      });

      writePage('library', filename, content, cwd);

      const extraNotes = params.notes ? `\n\n---\n**Notes:** ${params.notes}` : '';
      return ok(
        `✅ Library entry created [${pageId}] — ${title}\n` +
          `Platform: ${meta.platform} | Type: ${params.source_type ?? 'other'} | Priority: ${params.priority ?? 'medium'}\n` +
          `URL: ${params.url}${extraNotes}`,
        { id: pageId, url: params.url, platform: meta.platform, title }
      );
    },
  });
}

// ─── kb_create_research ──────────────────────────────────────────

export function registerResearchTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: 'kb_create_research',
    label: 'KB Create Research',
    description:
      'Track a research question through investigation. Records question, sources, findings, and confidence level.',
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

export function registerPlanTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: 'kb_create_plan',
    label: 'KB Create Plan',
    description:
      'Create a planning or brainstorming page. Records goal, constraints, options considered, and decision.',
    promptSnippet: 'Create a planning document',
    promptGuidelines: [
      'Use kb_create_plan for planning and brainstorming. Records goal, options, decision, and next steps.',
    ],
    parameters: Type.Object({
      title: Type.String({ description: 'Plan title (e.g. "How to structure the API layer")' }),
      goal: Type.String({ description: 'What this plan aims to achieve' }),
      scope: Type.Optional(
        Type.String({ description: 'Scope: small | medium | large', default: 'medium' })
      ),
      priority: Type.Optional(
        Type.String({ description: 'Priority: critical | high | medium | low', default: 'medium' })
      ),
      constraints: Type.Optional(Type.String({ description: 'Known constraints or boundaries' })),
      options: Type.Optional(Type.String({ description: 'Options considered (one per line)' })),
      decision: Type.Optional(Type.String({ description: 'Chosen approach and rationale' })),
      status: Type.Optional(
        Type.String({
          description: 'Status: draft | decided | in_progress | blocked',
          default: 'draft',
        })
      ),
      tags: Type.Optional(Type.Array(Type.String(), { description: 'Tags for categorization' })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd ?? process.cwd();
      const paths = vaultFromCtx(cwd);
      const pageId = getNextId(paths.wiki, 'plan');
      const opts = params.options
        ? params.options
            .split('\n')
            .map((o) => `- ${o}`)
            .join('\n')
        : '';

      const { content, filename } = buildPage('plan', params.title, paths, {
        id: pageId,
        status: params.status ?? 'draft',
        scope: params.scope ?? 'medium',
        priority: params.priority ?? 'medium',
        shared: 'false',
        stage: 'draft',
        tags: params.tags ?? [],
      });

      const body = [
        `## Goal\n\n${params.goal}`,
        params.constraints ? `## Constraints\n\n${params.constraints}` : '',
        opts ? `## Options Considered\n\n${opts}` : '',
        params.decision ? `## Decision\n\n${params.decision}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      writePage('plan', filename, `${content}\n\n${body}`, cwd);
      return ok(`✅ Plan created [${pageId}] — ${params.title}`, {
        id: pageId,
        goal: params.goal,
      });
    },
  });
}

// ─── kb_create_content ──────────────────────────────────────────

export function registerContentTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: 'kb_create_content',
    label: 'KB Create Content',
    description:
      'Create a content planning card for social media. Supports multi-platform: YouTube, LinkedIn, ' +
      'Twitter/X, Instagram, Threads, Mastodon, blog.',
    promptSnippet: 'Plan social media content',
    promptGuidelines: ['Use kb_create_content to plan and track content across platforms.'],
    parameters: Type.Object({
      title: Type.String({ description: 'Content title (e.g. "Thread: Why I switched to Bun")' }),
      idea: Type.String({ description: 'Core idea or hook — what is this content about?' }),
      platforms: Type.Array(Type.String(), {
        description:
          'Target platforms: youtube, linkedin, twitter, instagram, threads, mastodon, blog',
      }),
      status: Type.Optional(
        Type.String({
          description: 'Status: idea | drafting | scheduled | published',
          default: 'idea',
        })
      ),
      scheduled_date: Type.Optional(
        Type.String({ description: 'Planned publish date (YYYY-MM-DD)' })
      ),
      key_points: Type.Optional(Type.String({ description: 'Key points to cover (one per line)' })),
      hashtags: Type.Optional(
        Type.Array(Type.String(), {
          description: 'Hashtags to include (as-is, no # prefix needed)',
        })
      ),
      featured: Type.Optional(
        Type.Boolean({ description: 'Feature this content prominently', default: false })
      ),
      tags: Type.Optional(Type.Array(Type.String(), { description: 'Tags for categorization' })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd ?? process.cwd();
      const paths = vaultFromCtx(cwd);
      const pageId = getNextId(paths.wiki, 'content');
      const keyPts = params.key_points
        ? params.key_points
            .split('\n')
            .map((p) => `- ${p}`)
            .join('\n')
        : '';
      // Store platforms as YAML array string (already handled by buildPage's formatTags)
      const platformList = params.platforms.join(', ');

      const { content, filename } = buildPage('content', params.title, paths, {
        id: pageId,
        idea: params.idea,
        platforms: params.platforms,
        status: params.status ?? 'idea',
        scheduled_date: params.scheduled_date ?? '',
        published_date: '',
        featured: String(params.featured ?? false),
        stage: 'draft',
        tags: params.tags ?? [],
      });

      // Store hashtags as-is — format per-platform at publish time
      const hashtagBody =
        params.hashtags && params.hashtags.length > 0
          ? `## Hashtags\n\n${params.hashtags.map((h) => `- ${h}`).join('\n')}`
          : '';
      const body = [keyPts ? `## Key Points\n\n${keyPts}` : '', hashtagBody]
        .filter(Boolean)
        .join('\n\n');

      writePage('content', filename, `${content}\n\n${body}`, cwd);
      return ok(
        `✅ Content card created [${pageId}] — ${params.title}\n` +
          `Platforms: ${platformList} | Status: ${params.status ?? 'idea'}`,
        { id: pageId, platforms: params.platforms, idea: params.idea }
      );
    },
  });
}

// ─── kb_create_ticket ───────────────────────────────────────────

export function registerTicketTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: 'kb_create_ticket',
    label: 'KB Create Ticket',
    description:
      'Create a project ticket. Tickets are requirements that can link to GitHub issues ' +
      '(via github_repo + github_issue fields). Use for tracking features, bugs, and tasks ' +
      'that need an owner, priority, and status.',
    promptSnippet: 'Create a project ticket',
    promptGuidelines: [
      'Use kb_create_ticket to create a ticket for a project. Tickets track requirements with owner, priority, and status.',
    ],
    parameters: Type.Object({
      title: Type.String({ description: 'Ticket title (e.g. "Implement OAuth2 login")' }),
      project: Type.Optional(Type.String({ description: 'Project name or repo this belongs to' })),
      status: Type.Optional(
        Type.String({
          description: 'Status: backlog | todo | in_progress | review | done',
          default: 'backlog',
        })
      ),
      priority: Type.Optional(
        Type.String({ description: 'Priority: critical | high | medium | low', default: 'medium' })
      ),
      assignee: Type.Optional(Type.String({ description: 'Who owns this ticket' })),
      labels: Type.Optional(
        Type.Array(Type.String(), { description: 'Labels or tags (e.g. frontend, bug, auth)' })
      ),
      github_repo: Type.Optional(
        Type.String({ description: 'GitHub repo (e.g. owner/repo) — optional, for tracking' })
      ),
      github_issue: Type.Optional(Type.Integer({ description: 'GitHub issue number — optional' })),
      tags: Type.Optional(Type.Array(Type.String(), { description: 'Tags for categorization' })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd ?? process.cwd();
      const paths = vaultFromCtx(cwd);
      const pageId = getNextId(paths.wiki, 'ticket');

      const { content, filename } = buildPage('ticket', params.title, paths, {
        id: pageId,
        project: params.project ?? '',
        status: params.status ?? 'backlog',
        priority: params.priority ?? 'medium',
        assignee: params.assignee ?? '',
        labels: params.labels ?? [],
        github_repo: params.github_repo ?? '',
        github_issue: params.github_issue ? String(params.github_issue) : '',
        shared: 'false',
        stage: 'draft',
        tags: params.tags ?? [],
      });

      writePage('ticket', filename, content, cwd);

      const ghLink =
        params.github_repo && params.github_issue
          ? ` | GitHub: ${params.github_repo}#${params.github_issue}`
          : '';
      return ok(
        `✅ Ticket created [${pageId}] — ${params.title}\n` +
          `Status: ${params.status ?? 'backlog'} | Priority: ${params.priority ?? 'medium'}${ghLink}`,
        { id: pageId, status: params.status, priority: params.priority }
      );
    },
  });
}

// ─── kb_create_todo ─────────────────────────────────────────────

export function registerTodoTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: 'kb_create_todo',
    label: 'KB Create TODO',
    description:
      'Create a TODO item linked to a parent ticket or artifact. ' +
      'Use for granular tasks that belong to a bigger piece of work. ' +
      'Query all todos with kb_search_tags(type=todo).',
    promptSnippet: 'Create a TODO item',
    promptGuidelines: [
      'Use kb_create_todo to break down a ticket into actionable tasks. Link to parent ticket or artifact.',
    ],
    parameters: Type.Object({
      title: Type.String({ description: 'TODO title (e.g. "Add unit tests for auth module")' }),
      status: Type.Optional(
        Type.String({ description: 'Status: pending | in_progress | done', default: 'pending' })
      ),
      priority: Type.Optional(
        Type.String({ description: 'Priority: critical | high | medium | low', default: 'medium' })
      ),
      assignee: Type.Optional(Type.String({ description: 'Who owns this task' })),
      due: Type.Optional(Type.String({ description: 'Due date (YYYY-MM-DD)' })),
      parent_ticket: Type.Optional(
        Type.String({ description: 'Parent ticket ID (e.g. TICK-001)' })
      ),
      parent_artifact: Type.Optional(Type.String({ description: 'Parent artifact title or ID' })),
      tags: Type.Optional(Type.Array(Type.String(), { description: 'Tags for categorization' })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd ?? process.cwd();
      const paths = vaultFromCtx(cwd);
      const pageId = getNextId(paths.wiki, 'todo');

      const { content, filename } = buildPage('todo', params.title, paths, {
        id: pageId,
        status: params.status ?? 'pending',
        priority: params.priority ?? 'medium',
        assignee: params.assignee ?? '',
        due: params.due ?? '',
        parent_ticket: params.parent_ticket ?? '',
        parent_artifact: params.parent_artifact ?? '',
        stage: 'draft',
        tags: params.tags ?? [],
      });

      writePage('todo', filename, content, cwd);

      const parent = params.parent_ticket
        ? ` under ${params.parent_ticket}`
        : params.parent_artifact
          ? ` under artifact: ${params.parent_artifact}`
          : '';
      return ok(
        `✅ TODO created [${pageId}] — ${params.title}${parent}\n` +
          `Status: ${params.status ?? 'pending'} | Priority: ${params.priority ?? 'medium'}` +
          (params.due ? ` | Due: ${params.due}` : ''),
        {
          id: pageId,
          status: params.status,
          parent: params.parent_ticket ?? params.parent_artifact,
        }
      );
    },
  });
}

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
    label: 'KB Create Project',
    description:
      'Create a new project vault in a git repo. Bootstrap .kb/ structure, ' +
      'register the project in the root KB inventory, and create a project page. ' +
      'Run from inside a git repo.',
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
    label: 'KB List Projects',
    description:
      'List all project vaults registered in the root KB. ' +
      'Shows project ID, name, path, status, and description.',
    promptSnippet: 'List all projects',
    promptGuidelines: ['Use kb_list_projects to see all registered project vaults.'],
    parameters: Type.Object({}),
    async execute(_id, _params, _signal, _onUpdate, _ctx) {
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
