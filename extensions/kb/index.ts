import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { err, ok } from '../_shared/result';
import { captureFile, captureText } from './lib/capture';
import { findPageByTitle, formatEnrichmentResult, mergeObservationIntoPage } from './lib/enrich';
import { logEvent } from './lib/events';
import { installGuardrails } from './lib/guardrails';
import { getUningestedSources, markSourceIngested } from './lib/ingest';
import { formatLintReport, lintWiki } from './lib/lint';
import { rebuildMetadata } from './lib/metadata';
import { loadKBConfig } from './lib/models';
import { formatObservationResult, saveObservation } from './lib/observe';
import { formatRecallResults, searchByTag, searchWiki } from './lib/recall';
import { formatRetroResult, saveInsight } from './lib/retro';
import { buildPage, writeAgentsMd, writeDefaultTemplates } from './lib/templates';
import type { VaultPaths } from './lib/vault';
import {
  ensureVaultStructure,
  fmtDate,
  getExplicitVaultPaths,
  getVaultPaths,
  readJson,
  resolveVaultContext,
  writeJson,
} from './lib/vault';

// ─── Knowledge keywords that trigger auto-recall ───────────────────
// ponytail: simple contains-check is sufficient. Upgrade to fuzzy/embeddings when needed.
const KNOWLEDGE_KEYWORDS = [
  'architecture',
  'design',
  'pattern',
  'implementation',
  'api',
  'sdk',
  'library',
  'framework',
  'database',
  'protocol',
  'algorithm',
  'approach',
  'decision',
  'constraint',
  'requirement',
  'spec',
  'rfc',
  'standard',
  'component',
  'service',
  'module',
  'interface',
  'abstraction',
  'deployment',
  'infra',
  'config',
  'setup',
  'installation',
  'authentication',
  'authorization',
  'security',
  'performance',
  'optimization',
  'testing',
  'debugging',
  'error',
  'exception',
  'failure',
  'documentation',
  'docs',
  'readme',
  'guide',
  'tutorial',
];

function isKnowledgePrompt(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return KNOWLEDGE_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─── kb — Knowledge Base extension for Pi ────────────────────────
// 6 tools + hooks. Vault is explicit bootstrap only. Session logging deferred
// to pi-observational-memory (user's existing setup).

export default function (pi: ExtensionAPI) {
  // ─── Guardrails (vault path resolved per-event) ─────────────────
  installGuardrails();

  // ─── Register skills with pi ─────────────────────────────

  const skillsDir = join(dirname(fileURLToPath(import.meta.url)), 'skills');
  pi.on('resources_discover', () => ({ skillPaths: [skillsDir] }));

  // ─── kb_bootstrap ──────────────────────────────────────────────

  pi.registerTool({
    name: 'kb_bootstrap',
    label: 'KB Bootstrap',
    description:
      'Initialize a new .kb/ knowledge base vault at the current or specified directory. ' +
      'Auto-detects project vs personal mode based on context.',
    promptSnippet: 'Initialize a new KB vault',
    promptGuidelines: [
      'Use kb_bootstrap when setting up a new knowledge base for a project or personal use.',
    ],
    parameters: Type.Object({
      topic: Type.String({ description: 'Main topic of this knowledge base' }),
      mode: Type.Optional(
        Type.String({
          description: 'Vault mode: personal or project (auto-detected if omitted)',
        })
      ),
      root: Type.Optional(
        Type.String({
          description: 'Root directory (default: current working directory)',
        })
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const root = params.root ?? ctx.cwd ?? process.cwd();
      const { mode } = resolveVaultContext(root);
      const paths = getVaultPaths(root);
      const resolvedMode = params.mode || mode;

      ensureVaultStructure(paths);

      // Ask user whether to include AGENTS.md
      let writeAgentsFile = true;
      if (ctx.hasUI) {
        const choice = await ctx.ui.select('Write .kb/AGENTS.md?', [
          'yes \u2014 include minimal AGENTS.md (pointer to skills)',
          'skip \u2014 no AGENTS.md (skills only)',
        ]);
        writeAgentsFile = !choice?.startsWith('skip');
      }

      if (writeAgentsFile) {
        writeAgentsMd(paths, true);
      }

      writeJson(join(paths.dotKb, 'config.json'), {
        topic: params.topic,
        mode: resolvedMode,
        created: fmtDate(),
        version: '1.0',
      });

      writeDefaultTemplates(paths, resolvedMode);
      rebuildMetadata(paths);

      if (ctx.hasUI) {
        ctx.ui.setStatus('kb', `🧠 KB active — ${resolvedMode} (${params.topic})`);
      }

      return {
        content: [
          {
            type: 'text',
            text: [
              `✅ KB bootstrapped at \`${paths.dotKb}/\``,
              `Mode: **${resolvedMode}** | Topic: **${params.topic}**`,
              '',
              'Next: Use `kb_capture` with a file path or text to add your first source.',
            ].join('\n'),
          },
        ],
        details: { root: paths.dotKb, mode: resolvedMode, topic: params.topic },
      };
    },
  });

  // ─── kb_ensure_page ────────────────────────────────────────────

  pi.registerTool({
    name: 'kb_ensure_page',
    label: 'KB Ensure Page',
    description:
      'Create or update a wiki page with enforced template frontmatter. ' +
      'Page types: concept, entity, synthesis, analysis, source, artifact, meeting, diary. ' +
      'Templates are loaded from .kb/templates/pages/{type}.md and always applied.',
    promptSnippet: 'Create a KB wiki page from a template',
    promptGuidelines: [
      'Use kb_ensure_page to create new wiki pages. Templates are always enforced.',
    ],
    parameters: Type.Object({
      type: Type.String({
        description:
          'Page type: concept, entity, synthesis, analysis, source, artifact, meeting, diary',
      }),
      title: Type.String({ description: 'Page title' }),
      content: Type.Optional(
        Type.String({
          description: 'Page body content (optional; template provides structure if omitted)',
        })
      ),
      tags: Type.Optional(
        Type.Array(Type.String(), {
          description: 'Tags for the page (e.g. ["extension", "gh"])',
        })
      ),
      problem_tags: Type.Optional(
        Type.Array(Type.String(), {
          description: 'Tags for Problem Statement section (artifacts)',
        })
      ),
      research_tags: Type.Optional(
        Type.Array(Type.String(), {
          description: 'Tags for Research section (artifacts)',
        })
      ),
      ideas_tags: Type.Optional(
        Type.Array(Type.String(), {
          description: 'Tags for Ideas section (artifacts)',
        })
      ),
      tasks_tags: Type.Optional(
        Type.Array(Type.String(), {
          description: 'Tags for Tasks section (artifacts)',
        })
      ),
      impl_tags: Type.Optional(
        Type.Array(Type.String(), {
          description: 'Tags for Implementation section (artifacts)',
        })
      ),
      testing_tags: Type.Optional(
        Type.Array(Type.String(), {
          description: 'Tags for Testing section (artifacts)',
        })
      ),
      notes_tags: Type.Optional(
        Type.Array(Type.String(), {
          description: 'Tags for Notes section (artifacts)',
        })
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd ?? process.cwd();
      const { root } = resolveVaultContext(cwd);
      const paths = getVaultPaths(root);

      if (!existsSync(join(paths.dotKb, 'config.json'))) {
        return err('NO_VAULT', 'No KB vault found. Run `kb_bootstrap` first.');
      }

      const validTypes = [
        'concept',
        'entity',
        'synthesis',
        'analysis',
        'source',
        'meeting',
        'diary',
        'artifact',
      ];
      const pageType = validTypes.includes(params.type) ? params.type : 'concept';

      const { content, filename } = buildPage(
        pageType as Parameters<typeof buildPage>[0],
        params.title,
        paths,
        {
          tags: params.tags || [],
          problem_tags: params.problem_tags || [],
          research_tags: params.research_tags || [],
          ideas_tags: params.ideas_tags || [],
          tasks_tags: params.tasks_tags || [],
          impl_tags: params.impl_tags || [],
          testing_tags: params.testing_tags || [],
          notes_tags: params.notes_tags || [],
        }
      );

      const fullContent = params.content ? `${content}\n${params.content}` : content;

      const dirNames: Record<string, string> = {
        entity: 'entities',
        synthesis: 'syntheses',
        analysis: 'analyses',
        diary: 'diaries',
      };
      const typeDir = join(paths.wiki, dirNames[pageType] ?? `${pageType}s`);
      if (!existsSync(typeDir)) mkdirSync(typeDir, { recursive: true });

      writeFileSync(join(typeDir, filename), fullContent, 'utf-8');
      rebuildMetadata(paths);

      return {
        content: [
          {
            type: 'text',
            text: `✅ Created \`wiki/${pageType}s/${filename}\` — template enforced (type: ${pageType})`,
          },
        ],
        details: { path: `wiki/${pageType}s/${filename}`, type: pageType },
      };
    },
  });

  // ─── kb_capture ────────────────────────────────────────────────

  pi.registerTool({
    name: 'kb_capture',
    label: 'KB Capture',
    description:
      'Capture a file or text into the KB as an immutable source packet in raw/sources/. ' +
      'For URLs, use web-access fetch first, then capture the result. ' +
      'Supports: file paths and raw text.',
    promptSnippet: 'Capture file or text into KB raw sources',
    promptGuidelines: [
      'Use kb_capture to add sources to the knowledge base. For URLs, fetch with web-access first.',
    ],
    parameters: Type.Object({
      source: Type.String({
        description: 'File path (absolute or relative to cwd) or raw text content',
      }),
      title: Type.String({ description: 'Human-readable title for this source' }),
      type: Type.Optional(
        Type.String({
          description: 'Source type: file or text (auto-detected if omitted)',
        })
      ),
      vault: Type.Optional(
        Type.String({
          description: 'Target vault: personal, project, or auto (default: auto)',
        })
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd ?? process.cwd();

      // Determine vault based on explicit selection or auto-detect
      let paths: VaultPaths;
      const vaultChoice = params.vault || 'auto';
      if (vaultChoice === 'personal' || vaultChoice === 'project') {
        paths = getExplicitVaultPaths(vaultChoice, cwd);
      } else {
        const { root } = resolveVaultContext(cwd);
        paths = getVaultPaths(root);
      }

      if (!existsSync(join(paths.dotKb, 'config.json'))) {
        return err('NO_VAULT', 'No KB vault found. Run `kb_bootstrap` first.');
      }

      const sourceType = params.type || 'auto';
      let result: { sourceId: string; packetDir: string };

      if (sourceType === 'file' || sourceType === 'auto') {
        const resolvedPath = params.source.startsWith('/')
          ? params.source
          : resolvePath(cwd, params.source);
        if (existsSync(resolvedPath)) {
          try {
            result = captureFile(resolvedPath, params.title, paths);
          } catch (e) {
            return err('CAPTURE_FAILED', (e as Error).message);
          }
        } else if (sourceType === 'file') {
          return err('FILE_NOT_FOUND', `File not found: ${resolvedPath}`);
        } else {
          result = captureText(params.source, params.title, paths);
        }
      } else {
        result = captureText(params.source, params.title, paths);
      }

      return {
        content: [
          {
            type: 'text',
            text: [
              `✅ Source captured: \`${result.sourceId}\` — ${params.title}`,
              `Stored: \`${result.packetDir}/\``,
              '',
              'Next: Use `kb_ingest` to process pending sources.',
            ].join('\n'),
          },
        ],
        details: { sourceId: result.sourceId },
      };
    },
  });

  // ─── kb_ingest ─────────────────────────────────────────────────

  pi.registerTool({
    name: 'kb_ingest',
    label: 'KB Ingest',
    description:
      'List uningested sources in the KB raw/ directory. ' +
      "Read each source's extracted.md, then create wiki pages using kb_ensure_page.",
    promptSnippet: 'List uningested KB sources for processing',
    promptGuidelines: [
      'Use kb_ingest to find sources that need to be synthesized into wiki pages. ' +
        "After kb_ingest, read each source's extracted.md, then create pages with kb_ensure_page.",
    ],
    parameters: Type.Object({
      vault: Type.Optional(
        Type.String({
          description: 'Target vault: personal, project, or auto (default: auto)',
        })
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd ?? process.cwd();
      const vaultChoice = (params as { vault?: string }).vault || 'auto';
      const paths =
        vaultChoice === 'personal' || vaultChoice === 'project'
          ? getExplicitVaultPaths(vaultChoice, cwd)
          : getVaultPaths(resolveVaultContext(cwd).root);

      if (!existsSync(join(paths.dotKb, 'config.json'))) {
        return err('NO_VAULT', 'No KB vault found. Run `kb_bootstrap` first.', {
          vault: vaultChoice,
        });
      }

      const sources = getUningestedSources(paths);

      if (sources.length === 0) {
        return {
          content: [
            { type: 'text', text: '📭 No uningested sources. All sources have been processed.' },
          ],
          details: { count: 0 },
        };
      }

      const lines = [`📋 **${sources.length} uningested source(s):**`, ''];
      for (const s of sources) {
        lines.push(`- \`${s.sourceId}\` — ${s.title} (${s.type}, captured ${s.captured})`);
        lines.push(`  Extracted: \`${s.extractedPath}\``);
      }
      lines.push(
        '',
        "**To ingest:** Read each source's `extracted.md` using the `read` tool, " +
          'then create pages with `kb_ensure_page`. When done, mark the source ingested.'
      );

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        details: { count: sources.length, sources },
      };
    },
  });

  // ─── kb_recall_context ─────────────────────────────────────────

  pi.registerTool({
    name: 'kb_recall_context',
    label: 'KB Recall (Project-First)',
    description:
      'Search both project and personal KB vaults, prioritizing the project vault. ' +
      'Use this at task start for working-memory context.',
    promptSnippet: 'Search KB with project-vault priority',
    promptGuidelines: [
      'Use kb_recall_context at task start to find relevant project knowledge. Project vault pages appear first.',
    ],
    parameters: Type.Object({
      query: Type.String({ description: 'Search query (keywords)' }),
      maxResults: Type.Optional(Type.Number({ description: 'Max results (default: 5)' })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd ?? process.cwd();
      const ctx2 = resolveVaultContext(cwd);
      const projectPaths = ctx2.isProject ? getVaultPaths(ctx2.root) : null;
      const personalPaths = getVaultPaths(process.env.KB_HOME || homedir());

      const maxResults = params.maxResults ?? 5;
      const results = searchWiki(projectPaths, personalPaths, params.query, 'context', maxResults);
      const formatted = formatRecallResults(results);

      return {
        content: [
          {
            type: 'text',
            text: formatted || `No KB pages found for "${params.query}".`,
          },
        ],
        details: { results, mode: 'context' },
      };
    },
  });

  // ─── kb_recall_docs ────────────────────────────────────────────

  pi.registerTool({
    name: 'kb_recall_docs',
    label: 'KB Recall (Docs-First)',
    description:
      'Search both personal and project KB vaults, prioritizing the personal vault. ' +
      'Use this for documentation and library reference lookups.',
    promptSnippet: 'Search KB with personal-vault priority',
    promptGuidelines: [
      'Use kb_recall_docs when looking up documentation or library references. Personal vault pages appear first.',
    ],
    parameters: Type.Object({
      query: Type.String({ description: 'Search query (keywords)' }),
      maxResults: Type.Optional(Type.Number({ description: 'Max results (default: 5)' })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd ?? process.cwd();
      const ctx2 = resolveVaultContext(cwd);
      const projectPaths = ctx2.isProject ? getVaultPaths(ctx2.root) : null;
      const personalPaths = getVaultPaths(process.env.KB_HOME || homedir());

      const maxResults = params.maxResults ?? 5;
      const results = searchWiki(projectPaths, personalPaths, params.query, 'docs', maxResults);
      const formatted = formatRecallResults(results);

      return {
        content: [
          {
            type: 'text',
            text: formatted || `No KB pages found for "${params.query}".`,
          },
        ],
        details: { results, mode: 'docs' },
      };
    },
  });

  // ─── kb_mark_ingested ──────────────────────────────────────────

  pi.registerTool({
    name: 'kb_mark_ingested',
    label: 'KB Mark Ingested',
    description:
      'Mark a source packet as ingested after its wiki pages have been created. ' +
      'Removes it from the kb_ingest pending list.',
    promptSnippet: 'Mark a source as processed',
    promptGuidelines: [
      'After creating wiki pages from a source (kb_ingest), mark it ingested so it no longer appears in pending lists.',
    ],
    parameters: Type.Object({
      sourceId: Type.String({ description: 'Source ID (e.g. SRC-2026-06-26-001)' }),
      vault: Type.Optional(
        Type.String({
          description: 'Target vault: personal, project, or auto (default: auto)',
        })
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd ?? process.cwd();
      const vaultChoice = params.vault || 'auto';
      const paths =
        vaultChoice === 'personal' || vaultChoice === 'project'
          ? getExplicitVaultPaths(vaultChoice, cwd)
          : getVaultPaths(resolveVaultContext(cwd).root);

      if (!existsSync(join(paths.dotKb, 'config.json'))) {
        return err('NO_VAULT', 'No KB vault found. Run `kb_bootstrap` first.', {
          vault: vaultChoice,
        });
      }

      const ingested = markSourceIngested(params.sourceId, paths);
      return ingested
        ? ok(`Source \`${params.sourceId}\` marked as ingested.`, {
            sourceId: params.sourceId,
            vault: vaultChoice,
            ingested: true,
          })
        : err(
            'SOURCE_NOT_FOUND',
            `Source \`${params.sourceId}\` not found in ${vaultChoice} vault.`,
            {
              sourceId: params.sourceId,
              vault: vaultChoice,
            }
          );
    },
  });

  // ─── kb_status ────────────────────────────────────────────────

  pi.registerTool({
    name: 'kb_status',
    label: 'KB Status',
    description:
      'Show the current KB vault status: mode, page counts, pending sources, and recent activity.',
    promptSnippet: 'Show KB vault status',
    promptGuidelines: ['Use kb_status to inspect the current state of the knowledge base.'],
    parameters: Type.Object({}),
    async execute(_id, _params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd ?? process.cwd();
      const ctx2 = resolveVaultContext(cwd);
      const paths = getVaultPaths(ctx2.root);

      if (!existsSync(join(paths.dotKb, 'config.json'))) {
        return err('NO_VAULT', 'No KB vault found at this location.');
      }

      const config = readJson<{ topic: string; mode: string; created: string }>(
        join(paths.dotKb, 'config.json')
      );

      // Count wiki pages by type
      const wikiPages: Record<string, number> = {};
      let totalWiki = 0;
      // ponytail: handle typo dirs from earlier versions (entitys, synthesiss)
      const typeNames = [
        'sources',
        'entities',
        'concepts',
        'syntheses',
        'analyses',
        'artifacts',
        'meetings',
        'diaries',
      ];
      for (const type of typeNames) {
        const typeDir = join(paths.wiki, type);
        if (existsSync(typeDir)) {
          const files = readdirSync(typeDir).filter((f: string) => f.endsWith('.md'));
          wikiPages[type] = files.length;
          totalWiki += files.length;
        }
      }

      // Count pending sources
      const pending = getUningestedSources(paths);

      // Count templates
      const templateCount = existsSync(paths.templates)
        ? readdirSync(paths.templates).filter((f: string) => f.endsWith('.md')).length
        : 0;

      const lines = [
        `# 🧠 KB Status — ${ctx2.mode}`,
        '',
        `**Topic:** ${config?.topic || 'N/A'}`,
        `**Root:** ${paths.dotKb}`,
        `**Created:** ${config?.created || 'N/A'}`,
        '',
        '## Wiki Pages',
        '',
        ...Object.entries(wikiPages).map(([type, count]) => `- **${type}:** ${count}`),
        `- **Total:** ${totalWiki}`,
        '',
        '## Sources',
        '',
        `- **Pending:** ${pending.length}`,
        '',
        '## Templates',
        '',
        `- **Active:** ${templateCount}`,
      ];

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        details: { mode: ctx2.mode, wikiPages, pendingSources: pending.length, templateCount },
      };
    },
  });

  // ─── kb_search_tags ────────────────────────────────────────────

  pi.registerTool({
    name: 'kb_search_tags',
    label: 'KB Search Tags',
    description:
      'Search KB wiki pages by frontmatter tags, page type, or workflow stage. ' +
      'Tags: arbitrary labels. Types: concept, entity, synthesis, analysis, source, meeting, diary, artifact. ' +
      'Stages: brainstorm, draft, review, production.',
    promptSnippet: 'Search KB pages by tag, type, or workflow stage',
    promptGuidelines: [
      'Use kb_search_tags to find pages matching specific taxonomy. ' +
        'Omit filters to see all pages.',
    ],
    parameters: Type.Object({
      tag: Type.Optional(Type.String({ description: 'Frontmatter tag to search for' })),
      type: Type.Optional(
        Type.String({
          description:
            'Page type: concept, entity, synthesis, analysis, source, artifact, meeting, diary',
        })
      ),
      stage: Type.Optional(
        Type.String({
          description: 'Workflow stage: brainstorm, draft, review, production',
        })
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd ?? process.cwd();
      const ctx2 = resolveVaultContext(cwd);
      const projectPaths = ctx2.isProject ? getVaultPaths(ctx2.root) : null;
      const personalPaths = getVaultPaths(process.env.KB_HOME || homedir());

      const results = searchByTag(projectPaths, personalPaths, {
        tag: params.tag,
        type: params.type,
        stage: params.stage,
      });
      const formatted = formatRecallResults(results);

      return {
        content: [
          {
            type: 'text',
            text: formatted || 'No pages match the given filters.',
          },
        ],
        details: { results, filters: { tag: params.tag, type: params.type, stage: params.stage } },
      };
    },
  });

  // ─── kb_rebuild_meta ─────────────────────────────────────────

  pi.registerTool({
    name: 'kb_rebuild_meta',
    label: 'KB Rebuild Meta',
    description:
      'Manually trigger metadata rebuild (registry + backlinks). ' +
      'Normally auto-triggered after wiki edits via hooks. ' +
      'Use this when metadata seems stale or after manual wiki edits.',
    promptSnippet: 'Manually rebuild KB metadata',
    promptGuidelines: [
      'Use kb_rebuild_meta when metadata seems stale or after manual wiki edits outside of kb tools.',
    ],
    parameters: Type.Object({}),
    async execute(_id, _params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd ?? process.cwd();
      const { root } = resolveVaultContext(cwd);
      const paths = getVaultPaths(root);

      if (!existsSync(join(paths.dotKb, 'config.json'))) {
        return err('NO_VAULT', 'No KB vault found. Run `kb_bootstrap` first.');
      }

      rebuildMetadata(paths);

      return ok('✅ Metadata rebuilt — registry and backlinks updated.', { root: paths.dotKb });
    },
  });

  // ─── kb_lint ───────────────────────────────────────────────────

  pi.registerTool({
    name: 'kb_lint',
    label: 'KB Lint',
    description:
      'Health check for the wiki: orphan pages, broken wikilinks, empty pages, stale pages. ' +
      'Returns a structured lint report.',
    promptSnippet: 'Run KB health check',
    promptGuidelines: ['Use kb_lint to check wiki health. Run after ingest or periodically.'],
    parameters: Type.Object({
      staleDays: Type.Optional(
        Type.Number({
          description: 'Days before a page is considered stale (default: 30)',
        })
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd ?? process.cwd();
      const { root } = resolveVaultContext(cwd);
      const paths = getVaultPaths(root);

      if (!existsSync(join(paths.dotKb, 'config.json'))) {
        return err('NO_VAULT', 'No KB vault found. Run `kb_bootstrap` first.');
      }

      const report = lintWiki(paths, params.staleDays ?? 30);
      const formatted = formatLintReport(report);

      return ok(formatted, { summary: report.summary });
    },
  });

  // ─── kb_observe ───────────────────────────────────────────────

  pi.registerTool({
    name: 'kb_observe',
    label: 'KB Observe',
    description:
      'Mid-session observation capture. Lightweight write to wiki/sources/ with status: observation. ' +
      'Use for capturing insights during discussion that can later be integrated into canonical pages.',
    promptSnippet: 'Capture an observation during discussion',
    promptGuidelines: [
      'Use kb_observe when you find new information about an existing KB topic during discussion. ' +
        'Observations are searchable via kb_recall_* and can be integrated later.',
    ],
    parameters: Type.Object({
      title: Type.String({ description: 'Short descriptive title (≤80 chars)' }),
      content: Type.String({ description: 'The observation content' }),
      relevance: Type.String({
        description: 'Relevance level: low, medium, high, critical',
      }),
      tags: Type.Optional(
        Type.Array(Type.String(), {
          description: 'Tags for categorization',
        })
      ),
      sourceContext: Type.Optional(
        Type.String({
          description: 'Context: what was being worked on when this was observed',
        })
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd ?? process.cwd();
      const { root } = resolveVaultContext(cwd);
      const paths = getVaultPaths(root);

      if (!existsSync(join(paths.dotKb, 'config.json'))) {
        return err('NO_VAULT', 'No KB vault found. Run `kb_bootstrap` first.');
      }

      const result = saveObservation(paths, {
        title: params.title,
        content: params.content,
        relevance: params.relevance as 'low' | 'medium' | 'high' | 'critical',
        tags: params.tags,
        sourceContext: params.sourceContext,
      });

      const formatted = formatObservationResult(result, params.title);
      return ok(formatted, { sourceId: result.sourceId });
    },
  });

  // ─── kb_enrich ────────────────────────────────────────────────

  pi.registerTool({
    name: 'kb_enrich',
    label: 'KB Enrich',
    description:
      'Merge an observation into an existing wiki page with user approval. ' +
      'Finds the page, previews the merge, asks user to approve, then integrates.',
    promptSnippet: 'Merge observation into existing page',
    promptGuidelines: [
      'Use kb_enrich when new info should be added to an existing KB page. ' +
        'The tool finds the page, previews the merge, and asks user to approve before integrating.',
    ],
    parameters: Type.Object({
      pageTitle: Type.String({ description: 'Title of the existing page to enrich' }),
      observationTitle: Type.String({ description: 'Title for the enrichment section' }),
      observationContent: Type.String({ description: 'Content to add to the page' }),
      sourceContext: Type.Optional(
        Type.String({
          description: 'Context: what was being worked on when this was observed',
        })
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd ?? process.cwd();
      const { root } = resolveVaultContext(cwd);
      const paths = getVaultPaths(root);

      if (!existsSync(join(paths.dotKb, 'config.json'))) {
        return err('NO_VAULT', 'No KB vault found. Run `kb_bootstrap` first.');
      }

      // Find the page first
      const pagePath = findPageByTitle(paths, params.pageTitle);
      if (!pagePath) {
        return err('PAGE_NOT_FOUND', `Page not found: ${params.pageTitle}`);
      }

      // Ask user for approval if UI is available
      if (ctx.hasUI) {
        const choice = await ctx.ui.select(
          `Merge "${params.observationTitle}" into "${params.pageTitle}"?`,
          [
            'yes — merge observation into page',
            'observe — save as separate observation for now',
            "discard — this info isn't relevant",
          ]
        );

        if (!choice) {
          return ok('No choice made — observation saved for later.');
        }

        if (choice.startsWith('observe')) {
          // Save as observation instead
          saveObservation(paths, {
            title: params.observationTitle,
            content: params.observationContent,
            relevance: 'medium',
            tags: [],
            sourceContext: params.sourceContext,
          });
          rebuildMetadata(paths);
          return ok(`Saved as observation: ${params.observationTitle}`);
        }

        if (choice.startsWith('discard')) {
          return ok('Discarded — no changes made.');
        }
      }

      // Merge
      const result = mergeObservationIntoPage(
        paths,
        params.pageTitle,
        params.observationTitle,
        params.observationContent,
        params.sourceContext
      );

      if (result.merged) {
        rebuildMetadata(paths);
        logEvent(paths, {
          kind: 'enrichment',
          data: { page: params.pageTitle, observation: params.observationTitle },
        });
      }

      const formatted = formatEnrichmentResult(result);
      return ok(formatted, { merged: result.merged, pagePath: result.pagePath });
    },
  });

  // ─── kb_retro ─────────────────────────────────────────────────

  pi.registerTool({
    name: 'kb_retro',
    label: 'KB Retro',
    description:
      'Atomic insight capture at task end. Single markdown file, no source packet overhead. ' +
      'Use for saving quick insights, decisions, or learnings.',
    promptSnippet: 'Save an insight at task end',
    promptGuidelines: [
      'Use kb_retro to save atomic insights at task end. ' +
        'Lighter than kb_capture — single file, no source packet.',
    ],
    parameters: Type.Object({
      title: Type.String({ description: 'Insight title' }),
      body: Type.String({ description: 'Insight content' }),
      category: Type.Optional(
        Type.String({
          description: 'Category for grouping (e.g. decision, learning, pattern)',
        })
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd ?? process.cwd();
      const { root } = resolveVaultContext(cwd);
      const paths = getVaultPaths(root);

      if (!existsSync(join(paths.dotKb, 'config.json'))) {
        return err('NO_VAULT', 'No KB vault found. Run `kb_bootstrap` first.');
      }

      const result = saveInsight(paths, {
        title: params.title,
        body: params.body,
        category: params.category,
      });

      const formatted = formatRetroResult(result, params.title);
      return ok(formatted, { slug: result.slug });
    },
  });

  // ─── kb_log_event ─────────────────────────────────────────────

  pi.registerTool({
    name: 'kb_log_event',
    label: 'KB Log Event',
    description:
      'Append an event to meta/events.jsonl for audit trail. ' +
      'Each line is a self-contained JSON object.',
    promptSnippet: 'Log an event to KB audit trail',
    promptGuidelines: [
      'Use kb_log_event to record significant events: ingestions, page creations, etc.',
    ],
    parameters: Type.Object({
      kind: Type.String({ description: 'Event kind (e.g. ingest, page_create, lint)' }),
      data: Type.Optional(
        Type.Record(Type.String(), Type.Unknown(), {
          description: 'Additional event data',
        })
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd ?? process.cwd();
      const { root } = resolveVaultContext(cwd);
      const paths = getVaultPaths(root);

      if (!existsSync(join(paths.dotKb, 'config.json'))) {
        return err('NO_VAULT', 'No KB vault found. Run `kb_bootstrap` first.');
      }

      logEvent(paths, { kind: params.kind, data: params.data as Record<string, unknown> });

      return ok(`✅ Event logged: ${params.kind}`, { kind: params.kind });
    },
  });

  // ─── Hooks ─────────────────────────────────────────────────────

  // Status on session start — explicit bootstrap only (no auto-create)
  pi.on('session_start', async (_event, ctx) => {
    const cwd = ctx.cwd ?? process.cwd();
    const { mode, root } = resolveVaultContext(cwd);
    const paths = getVaultPaths(root);
    if (existsSync(join(paths.dotKb, 'config.json'))) {
      if (ctx.hasUI) ctx.ui.setStatus('kb', `🧠 KB — ${mode}`);
    }
  });

  // Smarter recall trigger: only fire on knowledge-related prompts
  pi.on('before_agent_start', async (event, ctx) => {
    const prompt = event.prompt || '';
    if (!prompt.trim() || !isKnowledgePrompt(prompt)) return;

    const cwd = ctx.cwd ?? process.cwd();
    const ctx2 = resolveVaultContext(cwd);
    const projectPaths = ctx2.isProject ? getVaultPaths(ctx2.root) : null;
    const personalPaths = getVaultPaths(process.env.KB_HOME || homedir());

    const results = searchWiki(projectPaths, personalPaths, prompt, 'context', 5);
    if (results.length === 0) return;

    const recallContext = formatRecallResults(results);
    return { systemPrompt: `${event.systemPrompt || ''}\n\n${recallContext}` };
  });

  // Rebuild metadata after wiki edits (only when kb tools were used)
  // Auto-ingest after kb_capture, auto-lint after ingest
  pi.on('tool_result', async (event, ctx) => {
    const kbTools = ['kb_ensure_page', 'kb_capture'];
    if (!kbTools.includes(event.toolName)) return;

    const cwd = ctx.cwd ?? process.cwd();
    const { root } = resolveVaultContext(cwd);
    const paths = getVaultPaths(root);

    if (!existsSync(join(paths.dotKb, 'config.json'))) return;

    // Load config to respect autoIngest/autoLint flags
    const cfg = loadKBConfig();

    // Auto-ingest after kb_capture (only if enabled in config)
    if (event.toolName === 'kb_capture' && cfg.autoIngest) {
      const pending = getUningestedSources(paths);
      for (const source of pending) {
        if (!existsSync(source.extractedPath)) continue;

        const { readFile } = await import('node:fs/promises');
        const extracted = await readFile(source.extractedPath, 'utf-8');
        const { content, filename } = buildPage('source', source.title, paths, {
          tags: ['auto-ingested'],
        });
        const pagePath = join(paths.wiki, 'sources', filename);
        mkdirSync(join(paths.wiki, 'sources'), { recursive: true });
        writeFileSync(pagePath, content.replace('{{content}}', extracted), 'utf-8');
        markSourceIngested(source.sourceId, paths);
        logEvent(paths, {
          kind: 'auto_ingest',
          data: { sourceId: source.sourceId, title: source.title },
        });
      }

      // Auto-lint after ingest (only if enabled in config)
      if (pending.length > 0 && cfg.autoLint) {
        const report = lintWiki(paths);
        if (report.summary.warnings > 0) {
          logEvent(paths, { kind: 'lint_warnings', data: { warnings: report.summary.warnings } });
        }
      }
    }

    // Rebuild metadata
    rebuildMetadata(paths);
  });
}
