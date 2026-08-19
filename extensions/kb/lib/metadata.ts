import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { VaultPaths } from './vault';
import { writeJson } from './vault';

// ponytail: simple registry + backlinks from markdown frontmatter.
// No YAML parser needed — regex extracts --- ... --- blocks.

export interface RegistryEntry {
  id: string;
  path: string;
  title: string;
  type: string;
  tags: string[];
  stage: string;
  status: string;
  run: string;
  created: string;
  updated: string;
  // Pipeline fields
  project?: string;
  parent?: string;
  children?: string[];
  priority?: string;
  owner?: string;
  tests_passing?: boolean;
  review_approved?: boolean;
  pr_linked?: string;
  sprint?: number;
  iteration?: number;
  maturity?: string;
  specs_total?: number;
  specs_done?: number;
  tasks_total?: number;
  tasks_done?: number;
  progress_pct?: number;
  // v2: handoff chain fields
  from_handoff?: string;
  to_handoff?: string;
  skip_reason?: string;
  task?: string;
  // v2: knowledge provenance fields
  derived_from?: string[];
  confidence?: string;
  last_verified?: string;
  // v2: ADR supersession
  superseded_by?: string;
}

export interface BacklinkEntry {
  source: string;
  targets: string[];
}

export function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const fm: Record<string, unknown> = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.+)/);
    if (!kv) continue;
    const key = kv[1];
    let val: unknown = kv[2].trim();
    // Strip surrounding quotes
    if (
      typeof val === 'string' &&
      ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
    ) {
      val = val.slice(1, -1);
    }
    // Parse YAML arrays: [a, b, c]
    if (typeof val === 'string' && val.startsWith('[') && val.endsWith(']')) {
      val = val
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''));
    }
    fm[key] = val;
  }
  return fm;
}

export function extractWikilinks(content: string): string[] {
  const links: string[] = [];
  const re = /\[\[([^\]]+)\]\]/g;
  for (const match of content.matchAll(re)) {
    links.push(match[1]);
  }
  return links;
}

export function rebuildMetadata(paths: VaultPaths): void {
  const registry: RegistryEntry[] = [];
  const backlinks: BacklinkEntry[] = [];

  if (!existsSync(paths.wiki)) return;

  function scanDir(dir: string): void {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        scanDir(full);
      } else if (e.name.endsWith('.md')) {
        const relPath = relative(paths.wiki, full);
        const content = readFileSync(full, 'utf-8');
        const fm = parseFrontmatter(content);

        const title = (fm.title as string) || e.name.replace(/\.md$/, '').replace(/-/g, ' ');
        registry.push({
          id: relPath.replace(/\.md$/, ''),
          path: relPath,
          title,
          type: (fm.type as string) || 'unknown',
          tags: Array.isArray(fm.tags) ? (fm.tags as string[]) : [],
          stage: (fm.stage as string) || 'brainstorm',
          status: (fm.status as string) || '',
          run: (fm.run as string) || '',
          created: (fm.created as string) || '',
          updated: (fm.updated as string) || '',
          // Pipeline fields
          project: (fm.project as string) || undefined,
          parent: (fm.parent as string) || undefined,
          children: Array.isArray(fm.children) ? (fm.children as string[]) : undefined,
          priority: (fm.priority as string) || undefined,
          owner: (fm.owner as string) || undefined,
          tests_passing:
            fm.tests_passing === true || fm.tests_passing === 'true' ? true : undefined,
          review_approved:
            fm.review_approved === true || fm.review_approved === 'true' ? true : undefined,
          pr_linked: (fm.pr_linked as string) || undefined,
          sprint: typeof fm.sprint === 'number' ? fm.sprint : undefined,
          iteration: typeof fm.iteration === 'number' ? fm.iteration : undefined,
          maturity: (fm.maturity as string) || undefined,
          specs_total: typeof fm.specs_total === 'number' ? fm.specs_total : undefined,
          specs_done: typeof fm.specs_done === 'number' ? fm.specs_done : undefined,
          tasks_total: typeof fm.tasks_total === 'number' ? fm.tasks_total : undefined,
          tasks_done: typeof fm.tasks_done === 'number' ? fm.tasks_done : undefined,
          progress_pct: typeof fm.progress_pct === 'number' ? fm.progress_pct : undefined,
          // v2: handoff chain fields
          from_handoff: (fm.from_handoff as string) || undefined,
          to_handoff: (fm.to_handoff as string) || undefined,
          skip_reason: (fm.skip_reason as string) || undefined,
          task: (fm.task as string) || undefined,
          // v2: knowledge provenance
          derived_from: Array.isArray(fm.derived_from) ? (fm.derived_from as string[]) : undefined,
          confidence: (fm.confidence as string) || undefined,
          last_verified: (fm.last_verified as string) || undefined,
          superseded_by: (fm.superseded_by as string) || undefined,
        });

        const targets = extractWikilinks(content);
        if (targets.length > 0) {
          backlinks.push({ source: relPath, targets });
        }
      }
    }
  }

  scanDir(paths.wiki);

  writeJson(join(paths.meta, 'registry.json'), registry);
  writeJson(join(paths.meta, 'backlinks.json'), backlinks);
}
