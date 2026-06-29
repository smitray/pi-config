import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { VaultPaths } from './vault';
import { fmtDate } from './vault';

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
  | 'artifact';

// Extension dir resolved once at import time
const EXT_DIR = join(import.meta.dirname ?? __dirname, '..');

export function writeDefaultTemplates(paths: VaultPaths, mode?: string): void {
  const pagesDir = join(EXT_DIR, 'templates', 'pages');
  const types = ['concept', 'entity', 'synthesis', 'analysis', 'source', 'meeting', 'diary'];
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

## Tools

| Tool | Purpose |
|------|---------|
| \`kb_bootstrap\` | Initialize vault |
| \`kb_capture\` | Capture file/text into raw/ |
| \`kb_ingest\` | List pending sources |
| \`kb_ensure_page\` | Create wiki page |
| \`kb_mark_ingested\` | Mark source processed |
| \`kb_status\` | Vault health |
| \`kb_recall_context\` | Search (project first) |
| \`kb_recall_docs\` | Search (docs first) |
| \`kb_search_tags\` | Search by tag/type/stage |

## Page Format

\`\`\`yaml
---
title: "Page Title"
type: source | entity | concept | synthesis | analysis
tags: []
stage: brainstorm | draft | review | production
---
\`\`\`

Use \`[[PageName]]\` wikilinks to cross-reference.
`;

export function writeAgentsMd(paths: VaultPaths, minimal = false): void {
  const target = join(paths.dotKb, 'AGENTS.md');
  if (existsSync(target)) return;

  if (minimal) {
    writeFileSync(target, MINIMAL_AGENTS_MD, 'utf-8');
    return;
  }

  // Read from extension template
  const templatePath = join(EXT_DIR, 'templates', 'AGENTS.md');
  if (existsSync(templatePath)) {
    writeFileSync(target, readFileSync(templatePath, 'utf-8'), 'utf-8');
    return;
  }

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
    created: today,
    updated: today,
    stage: 'brainstorm',
    feature: '',
    prefix: '',
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

  let filename: string;
  if (type === 'artifact' && extraVars.prefix) {
    // Artifact: {prefix}-{slug}-{date}.md
    const prefix = extraVars.prefix as ArtifactPrefix;
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    filename = `${prefix}-${slug}-${today}.md`;
  } else {
    // Default: {slug}.md
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    filename = `${slug}.md`;
  }

  return { content, filename };
}
