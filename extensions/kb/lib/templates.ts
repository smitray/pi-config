import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fmtDate, type VaultPaths } from './vault';

// Templates live in extensions/kb/templates/pages/ as single source of truth.
// Copied to vault on bootstrap. kb_ensure_page reads from vault or extension.

export type PageType =
  | 'concept'
  | 'entity'
  | 'synthesis'
  | 'analysis'
  | 'source'
  | 'meeting'
  | 'diary'
  | 'handoff'
  | 'artifact'
  | 'schedule'
  | 'library'
  | 'research'
  | 'plan'
  | 'content'
  | 'ticket'
  | 'todo';

// Extension dir resolved once at import time
const EXT_DIR = join(import.meta.dirname ?? __dirname, '..');

export function writeDefaultTemplates(paths: VaultPaths, mode?: string): void {
  const pagesDir = join(EXT_DIR, 'templates', 'pages');
  const types = [
    'concept',
    'entity',
    'synthesis',
    'analysis',
    'source',
    'meeting',
    'diary',
    'handoff',
    'schedule',
    'library',
    'research',
    'plan',
    'content',
    'ticket',
    'todo',
  ];
  // Artifact template is project-only
  if (mode !== 'personal') types.push('artifact');

  for (const type of types) {
    const target = join(paths.templates, `${type}.md`);
    if (existsSync(target)) continue;

    const src = join(pagesDir, `${type}.md`);
    if (existsSync(src)) {
      writeFileSync(target, readFileSync(src, 'utf-8'), 'utf-8');
    }
  }
}

const MINIMAL_AGENTS_MD = `# Knowledge Base

This \`.kb/\` directory is a Karpathy-style LLM Wiki maintained by the \`kb\` pi extension.

## Skills (auto-loaded when KB extension is active)

- \`kb\` \u2014 full tool reference
- \`kb-research\` \u2014 research & save to KB
- \`kb-capture-url\` \u2014 capture GitHub/docs/YouTube
- \`kb-bootstrap\` \u2014 init a new vault
- \`kb-update\` \u2014 update existing pages

## Layout

\`\`\`
.kb/
\u251c\u2500\u2500 raw/sources/    # immutable source packets
\u251c\u2500\u2500 wiki/           # agent-owned pages (concepts/entities/syntheses/analyses/...)
\u251c\u2500\u2500 meta/           # auto-generated registry, backlinks, embeddings, events
\u2514\u2500\u2500 templates/      # page templates
\`\`\`

## Per-vault notes

<!-- Add your project-specific conventions below this line -->
`;

export function writeAgentsMd(paths: VaultPaths): void {
  const target = join(paths.dotKb, 'AGENTS.md');
  if (existsSync(target)) return;
  writeFileSync(target, MINIMAL_AGENTS_MD, 'utf-8');
}

export function loadTemplate(type: PageType, paths: VaultPaths): string {
  // 1. Vault copy (user customized)
  const disk = join(paths.templates, `${type}.md`);
  if (existsSync(disk)) return readFileSync(disk, 'utf-8');

  // 2. Extension copy (source of truth)
  const ext = join(EXT_DIR, 'templates', 'pages', `${type}.md`);
  if (existsSync(ext)) return readFileSync(ext, 'utf-8');

  // 3. Should not happen
  return `---\ntitle: "{{title}}"\ntype: ${type}\n---\n\n# {{title}}\n`;
}

export function populateTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

// Artifact prefixes: feat/fix/wip/docs/refactor/test/chore/revert/perf/ci/build
export type ArtifactPrefix =
  | 'feat'
  | 'fix'
  | 'wip'
  | 'docs'
  | 'refactor'
  | 'test'
  | 'chore'
  | 'revert'
  | 'perf'
  | 'ci'
  | 'build';

export function buildPage(
  type: PageType,
  title: string,
  paths: VaultPaths,
  extraVars: Record<string, string | string[]> = {}
): { content: string; filename: string } {
  const template = loadTemplate(type, paths);
  const today = fmtDate();

  // Format tags as YAML array
  const formatTags = (input: string | string[] | undefined): string => {
    if (!input) return '';
    const arr = Array.isArray(input) ? input : input.split(',').map((t) => t.trim());
    return arr
      .filter(Boolean)
      .map((t) => `"${t}"`)
      .join(', ');
  };

  // Build template vars — spread extraVars first, then override with formatted tags
  const vars: Record<string, string> = {
    title,
    date: today,
    created: today,
    updated: today,
    stage: 'brainstorm',
    status: '',
    feature: '',
    prefix: '',
    run: '',
    started_at: '',
    completed_at: '',
    execution_time: '',
    depends_on: '',
    related_pages: '',
    todos: '',
    gortex_refs: '',
    ...extraVars,
    // Override tag fields with formatted versions (must come AFTER spread)
    tags: formatTags(extraVars.tags),
    problem_tags: formatTags(extraVars.problem_tags),
    research_tags: formatTags(extraVars.research_tags),
    ideas_tags: formatTags(extraVars.ideas_tags),
    tasks_tags: formatTags(extraVars.tasks_tags),
    impl_tags: formatTags(extraVars.impl_tags),
    testing_tags: formatTags(extraVars.testing_tags),
    notes_tags: formatTags(extraVars.notes_tags),
  };

  const content = populateTemplate(template, vars);

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const id = (extraVars.id as string | undefined) ?? '';

  let filename: string;
  if (type === 'artifact' && extraVars.prefix) {
    // Artifact: {prefix}-{slug}-{date}.md
    filename = `${extraVars.prefix}-${slug}-${today}.md`;
  } else if (id) {
    // ID-based types: use short type prefix from DIR_NAMES key
    const shortMap: Record<string, string> = {
      schedule: 'sched',
      library: 'lib',
      research: 'res',
      plan: 'plan',
      content: 'cont',
      ticket: 'tick',
      todo: 'todo',
    };
    filename = `${shortMap[type] ?? type}-${id}.md`;
  } else {
    // Default: {slug}.md
    filename = `${slug}.md`;
  }

  return { content, filename };
}
