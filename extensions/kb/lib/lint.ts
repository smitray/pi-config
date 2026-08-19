import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative } from 'node:path';
import { extractWikilinks, parseFrontmatter } from './metadata';
import type { VaultPaths } from './vault';
import { readJson } from './vault';

export type LintIssueType =
  | 'orphan'
  | 'broken_link'
  | 'missing_page'
  | 'stale'
  | 'empty'
  | 'no_type'
  | 'not_in_registry'
  | 'broken_chain'
  | 'bad_derived_from'
  | 'role_skill_missing'
  | 'stale_production';

export interface LintIssue {
  type: LintIssueType;
  severity: 'warning' | 'info';
  page: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface LintReport {
  issues: LintIssue[];
  summary: {
    total: number;
    warnings: number;
    info: number;
    orphans: number;
    brokenLinks: number;
    missingPages: number;
    stale: number;
    empty: number;
    noType: number;
    notInRegistry: number;
    brokenChain: number;
    badDerivedFrom: number;
    roleSkillMissing: number;
    staleProduction: number;
  };
}

interface WikiPage {
  content: string;
  links: string[];
  modified: number;
  fm: Record<string, unknown>;
  rel: string;
}

/**
 * Scan all wiki pages and collect their paths + wikilinks + frontmatter.
 */
function scanWikiPages(wikiDir: string): Map<string, WikiPage> {
  const pages = new Map<string, WikiPage>();

  function scanDir(dir: string): void {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(full);
      } else if (entry.name.endsWith('.md')) {
        const content = readFileSync(full, 'utf-8');
        const links = extractWikilinks(content);
        const stat = statSync(full);
        const rel = relative(wikiDir, full).replace(/\.md$/, '');
        pages.set(rel, {
          content,
          links,
          modified: stat.mtimeMs,
          fm: parseFrontmatter(content),
          rel,
        });
      }
    }
  }

  scanDir(wikiDir);
  return pages;
}

/**
 * Normalize a wikilink target to a page key.
 */
function normalizeLink(link: string): string {
  return link.split('|')[0].replace(/\s+/g, '-').replace(/\.md$/, '');
}

function findOrphans(pages: Map<string, WikiPage>): string[] {
  const linkedPages = new Set<string>();
  for (const { links } of pages.values()) {
    for (const link of links) {
      linkedPages.add(normalizeLink(link));
    }
  }
  const orphans: string[] = [];
  for (const key of pages.keys()) {
    if (!linkedPages.has(key)) orphans.push(key);
  }
  return orphans;
}

function findBrokenLinks(pages: Map<string, WikiPage>): Array<{ source: string; target: string }> {
  const broken: Array<{ source: string; target: string }> = [];
  for (const [source, { links }] of pages) {
    for (const link of links) {
      const target = normalizeLink(link);
      if (!pages.has(target)) broken.push({ source, target: link });
    }
  }
  return broken;
}

function findEmptyPages(pages: Map<string, WikiPage>): string[] {
  const empty: string[] = [];
  for (const [key, { content }] of pages) {
    const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
    if (body.length < 10) empty.push(key);
  }
  return empty;
}

function findStalePages(pages: Map<string, WikiPage>, staleDays: number) {
  const now = Date.now();
  const staleMs = staleDays * 24 * 60 * 60 * 1000;
  const stale: Array<{ page: string; daysSinceUpdate: number }> = [];
  for (const [key, { modified }] of pages) {
    const age = now - modified;
    if (age > staleMs) stale.push({ page: key, daysSinceUpdate: Math.floor(age / 86400000) });
  }
  return stale;
}

/**
 * v2: pages whose frontmatter type is missing or not a known type.
 * A wiki file without a matching `type:` is the signature of a direct write
 * that bypassed the typed tools.
 */
const KNOWN_TYPES = new Set([
  'concept',
  'entity',
  'synthesis',
  'analysis',
  'source',
  'handoff',
  'research',
  'context',
  'adr',
  'project',
  'library-doc',
  'daily-log',
  'brainstorm',
  'sprint-plan',
  'spec',
  'task',
]);

function findNoType(pages: Map<string, WikiPage>): string[] {
  const bad: string[] = [];
  for (const [key, { fm }] of pages) {
    const t = fm.type as string | undefined;
    if (!t || !KNOWN_TYPES.has(t)) bad.push(key);
  }
  return bad;
}

function findNotInRegistry(pages: Map<string, WikiPage>, registryPath: string): string[] {
  const registry = readJson<Array<{ path: string }>>(registryPath) ?? [];
  const known = new Set(registry.map((r) => r.path));
  const missing: string[] = [];
  for (const key of pages.keys()) {
    if (!known.has(`${key}.md`)) missing.push(key);
  }
  return missing;
}

/**
 * v2: handoff pages with broken from_handoff / to_handoff chain pointers.
 */
function findBrokenChain(pages: Map<string, WikiPage>): string[] {
  const handoffIds = new Set<string>();
  for (const [, { fm }] of pages) {
    if (fm.type === 'handoff' && fm.id) handoffIds.add(fm.id as string);
  }
  const broken: string[] = [];
  for (const [key, { fm }] of pages) {
    if (fm.type !== 'handoff') continue;
    for (const field of ['from_handoff', 'to_handoff']) {
      const ref = fm[field] as string | undefined;
      if (ref && !handoffIds.has(ref)) broken.push(`${key} (${field}: ${ref})`);
    }
  }
  return broken;
}

/**
 * v2: pages whose derived_from references SRC-/HOFF- IDs that don't exist.
 */
function findBadDerivedFrom(pages: Map<string, WikiPage>, rawSourcesDir: string): string[] {
  const known = new Set<string>();
  if (existsSync(rawSourcesDir)) {
    for (const dir of readdirSync(rawSourcesDir)) known.add(dir);
  }
  for (const [, { fm }] of pages) {
    if (fm.type === 'handoff' && fm.id) known.add(fm.id as string);
  }
  const bad: string[] = [];
  for (const [key, { fm }] of pages) {
    const refs = fm.derived_from;
    if (!Array.isArray(refs)) continue;
    for (const ref of refs) {
      const id = String(ref).trim();
      if (!known.has(id)) bad.push(`${key} (derived_from: ${id})`);
    }
  }
  return bad;
}

/**
 * v2: role pages (wiki/agents/) referencing skills that aren't installed.
 * Skills are considered installed when a SKILL.md exists under the agent skills dirs.
 */
function installedSkillDirs(): string[] {
  const home = process.env.HOME || homedir();
  return [
    join(home, '.pi', 'agent', 'skills'),
    join(home, '.pi', 'agent', 'git', 'github.com', 'DietrichGebert', 'ponytail', 'skills'),
  ];
}

function findRoleSkillMissing(pages: Map<string, WikiPage>): string[] {
  const dirs = installedSkillDirs();
  const installed = new Set<string>();
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (existsSync(join(dir, name, 'SKILL.md'))) installed.add(name);
    }
  }
  const bad: string[] = [];
  for (const [key, { fm }] of pages) {
    if (!key.startsWith('agents/')) continue;
    const skills = fm.skills;
    if (!Array.isArray(skills)) continue;
    for (const s of skills) {
      const name = String(s).trim();
      if (name && !installed.has(name)) bad.push(`${key} (skill: ${name})`);
    }
  }
  return bad;
}

/**
 * v2: production pages with last_verified older than 90 days.
 */
function findStaleProduction(pages: Map<string, WikiPage>): string[] {
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const bad: string[] = [];
  for (const [key, { fm }] of pages) {
    if (fm.stage !== 'production') continue;
    const verified = fm.last_verified as string | undefined;
    if (!verified) continue;
    if (new Date(verified).getTime() < cutoff) {
      bad.push(`${key} (last_verified: ${verified})`);
    }
  }
  return bad;
}

/**
 * Run a full lint check on the wiki.
 */
export function lintWiki(paths: VaultPaths, staleDays = 30): LintReport {
  const issues: LintIssue[] = [];
  const pages = scanWikiPages(paths.wiki);

  const push = (
    type: LintIssueType,
    severity: 'warning' | 'info',
    page: string,
    message: string,
    details?: Record<string, unknown>
  ) => {
    issues.push({ type, severity, page, message, details });
  };

  // 1. Orphans
  for (const page of findOrphans(pages)) {
    push('orphan', 'info', page, 'No inbound wikilinks — page is not referenced by other pages');
  }

  // 2. Broken links
  for (const { source, target } of findBrokenLinks(pages)) {
    push(
      'broken_link',
      'warning',
      source,
      `Broken wikilink: [[${target}]] — target page does not exist`,
      { target }
    );
  }

  // 3. Empty pages
  for (const page of findEmptyPages(pages)) {
    push('empty', 'info', page, 'Page has no content beyond frontmatter');
  }

  // 4. Stale pages
  for (const { page, daysSinceUpdate } of findStalePages(pages, staleDays)) {
    push('stale', 'info', page, `Page not updated in ${daysSinceUpdate} days`, { daysSinceUpdate });
  }

  // v2: 5. No/unknown frontmatter type — direct-write pollution signature
  for (const page of findNoType(pages)) {
    push(
      'no_type',
      'warning',
      page,
      'Frontmatter type is missing or not a known page type — likely written directly, bypassing typed tools'
    );
  }

  // v2: 6. Not in registry
  const registryPath = join(paths.meta, 'registry.json');
  if (existsSync(registryPath)) {
    for (const page of findNotInRegistry(pages, registryPath)) {
      push(
        'not_in_registry',
        'warning',
        page,
        'File exists in wiki/ but is missing from meta/registry.json — run kb_rebuild_meta'
      );
    }
  }

  // v2: 7. Broken handoff chain pointers
  for (const page of findBrokenChain(pages)) {
    push(
      'broken_chain',
      'warning',
      page,
      'Handoff chain pointer references a non-existent handoff'
    );
  }

  // v2: 8. derived_from references
  for (const page of findBadDerivedFrom(pages, paths.rawSources)) {
    push(
      'bad_derived_from',
      'warning',
      page,
      'derived_from references a non-existent source or handoff'
    );
  }

  // v2: 9. Role pages referencing uninstalled skills
  for (const page of findRoleSkillMissing(pages)) {
    push(
      'role_skill_missing',
      'warning',
      page,
      'Role page references a skill that is not installed'
    );
  }

  // v2: 10. Stale production pages
  for (const page of findStaleProduction(pages)) {
    push('stale_production', 'info', page, 'Production page last verified over 90 days ago');
  }

  const summary = {
    total: issues.length,
    warnings: issues.filter((i) => i.severity === 'warning').length,
    info: issues.filter((i) => i.severity === 'info').length,
    orphans: issues.filter((i) => i.type === 'orphan').length,
    brokenLinks: issues.filter((i) => i.type === 'broken_link').length,
    missingPages: 0,
    stale: issues.filter((i) => i.type === 'stale').length,
    empty: issues.filter((i) => i.type === 'empty').length,
    noType: issues.filter((i) => i.type === 'no_type').length,
    notInRegistry: issues.filter((i) => i.type === 'not_in_registry').length,
    brokenChain: issues.filter((i) => i.type === 'broken_chain').length,
    badDerivedFrom: issues.filter((i) => i.type === 'bad_derived_from').length,
    roleSkillMissing: issues.filter((i) => i.type === 'role_skill_missing').length,
    staleProduction: issues.filter((i) => i.type === 'stale_production').length,
  };

  return { issues, summary };
}

/**
 * Format lint report as markdown.
 */
export function formatLintReport(report: LintReport): string {
  const { issues, summary } = report;

  if (issues.length === 0) {
    return '✅ **Lint passed** — no issues found.';
  }

  const groups: Array<[string, LintIssueType[], string]> = [
    ['⚠️ Broken Wikilinks', ['broken_link'], 'brokenLinks'],
    ['🔗 Orphan Pages', ['orphan'], 'orphans'],
    ['📭 Empty Pages', ['empty'], 'empty'],
    ['⏰ Stale Pages', ['stale'], 'stale'],
    ['🧬 No Frontmatter Type', ['no_type'], 'noType'],
    ['📇 Not in Registry', ['not_in_registry'], 'notInRegistry'],
    ['⛓️ Broken Handoff Chains', ['broken_chain'], 'brokenChain'],
    ['🧪 Bad derived_from', ['bad_derived_from'], 'badDerivedFrom'],
    ['🛠️ Role Skills Missing', ['role_skill_missing'], 'roleSkillMissing'],
    ['🏚️ Stale Production Pages', ['stale_production'], 'staleProduction'],
  ];

  const lines: string[] = [
    `# 🔍 Lint Report`,
    '',
    `**${summary.total} issue(s)** — ${summary.warnings} warning(s), ${summary.info} info`,
    '',
  ];

  for (const [title, types, countKey] of groups) {
    const count = summary[countKey as keyof typeof summary] as number;
    if (count === 0) continue;
    lines.push(`## ${title} (${count})`, '');
    for (const issue of issues.filter((i) => types.includes(i.type))) {
      lines.push(`- \`${issue.page}\`: ${issue.message}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
