import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { extractWikilinks } from './metadata';
import type { VaultPaths } from './vault';

export interface LintIssue {
  type: 'orphan' | 'broken_link' | 'missing_page' | 'stale' | 'empty';
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
  };
}

/**
 * Scan all wiki pages and collect their paths + wikilinks.
 */
function scanWikiPages(
  wikiDir: string
): Map<string, { content: string; links: string[]; modified: number }> {
  const pages = new Map<string, { content: string; links: string[]; modified: number }>();

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
        // Use filename without extension as the page key
        const key = entry.name.replace(/\.md$/, '');
        pages.set(key, { content, links, modified: stat.mtimeMs });
      }
    }
  }

  scanDir(wikiDir);
  return pages;
}

/**
 * Normalize a wikilink target to a page key.
 * [[Foo Bar]] → "foo-bar"
 * [[foo-bar]] → "foo-bar"
 */
function normalizeLink(link: string): string {
  return link.toLowerCase().replace(/\s+/g, '-').replace(/\.md$/, '');
}

/**
 * Check for orphan pages (no inbound wikilinks from other pages).
 */
function findOrphans(pages: Map<string, { links: string[] }>): string[] {
  // Collect all link targets
  const linkedPages = new Set<string>();
  for (const { links } of pages.values()) {
    for (const link of links) {
      linkedPages.add(normalizeLink(link));
    }
  }

  // Find pages with no inbound links (excluding self-links)
  const orphans: string[] = [];
  for (const [key] of pages) {
    if (!linkedPages.has(key)) {
      orphans.push(key);
    }
  }
  return orphans;
}

/**
 * Check for broken wikilinks (target page doesn't exist).
 */
function findBrokenLinks(
  pages: Map<string, { links: string[] }>
): Array<{ source: string; target: string }> {
  const broken: Array<{ source: string; target: string }> = [];

  for (const [source, { links }] of pages) {
    for (const link of links) {
      const target = normalizeLink(link);
      if (!pages.has(target)) {
        broken.push({ source, target: link });
      }
    }
  }
  return broken;
}

/**
 * Check for empty pages (no content beyond frontmatter).
 */
function findEmptyPages(pages: Map<string, { content: string }>): string[] {
  const empty: string[] = [];

  for (const [key, { content }] of pages) {
    // Remove frontmatter
    const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
    if (body.length < 10) {
      empty.push(key);
    }
  }
  return empty;
}

/**
 * Check for stale pages (not updated in N days).
 */
function findStalePages(
  pages: Map<string, { modified: number }>,
  staleDays: number
): Array<{ page: string; daysSinceUpdate: number }> {
  const now = Date.now();
  const staleMs = staleDays * 24 * 60 * 60 * 1000;
  const stale: Array<{ page: string; daysSinceUpdate: number }> = [];

  for (const [key, { modified }] of pages) {
    const age = now - modified;
    if (age > staleMs) {
      stale.push({ page: key, daysSinceUpdate: Math.floor(age / (24 * 60 * 60 * 1000)) });
    }
  }
  return stale;
}

/**
 * Run a full lint check on the wiki.
 *
 * Checks:
 * 1. Orphan pages (no inbound wikilinks)
 * 2. Broken wikilinks (target doesn't exist)
 * 3. Empty pages (no content beyond frontmatter)
 * 4. Stale pages (not updated in N days)
 *
 * ponytail: skipped "missing cross-references" check — it requires NLP/entity
 * detection which is overkill for a lint tool. Add when vault hits 500+ pages.
 */
export function lintWiki(paths: VaultPaths, staleDays = 30): LintReport {
  const issues: LintIssue[] = [];
  const pages = scanWikiPages(paths.wiki);

  // 1. Orphans
  const orphans = findOrphans(pages);
  for (const page of orphans) {
    issues.push({
      type: 'orphan',
      severity: 'info',
      page,
      message: `No inbound wikilinks — page is not referenced by other pages`,
    });
  }

  // 2. Broken links
  const brokenLinks = findBrokenLinks(pages);
  for (const { source, target } of brokenLinks) {
    issues.push({
      type: 'broken_link',
      severity: 'warning',
      page: source,
      message: `Broken wikilink: [[${target}]] — target page does not exist`,
      details: { target },
    });
  }

  // 3. Empty pages
  const emptyPages = findEmptyPages(pages);
  for (const page of emptyPages) {
    issues.push({
      type: 'empty',
      severity: 'info',
      page,
      message: 'Page has no content beyond frontmatter',
    });
  }

  // 4. Stale pages
  const stalePages = findStalePages(pages, staleDays);
  for (const { page, daysSinceUpdate } of stalePages) {
    issues.push({
      type: 'stale',
      severity: 'info',
      page,
      message: `Page not updated in ${daysSinceUpdate} days`,
      details: { daysSinceUpdate },
    });
  }

  // Build summary
  const summary = {
    total: issues.length,
    warnings: issues.filter((i) => i.severity === 'warning').length,
    info: issues.filter((i) => i.severity === 'info').length,
    orphans: orphans.length,
    brokenLinks: brokenLinks.length,
    missingPages: 0, // ponytail: skipped — needs NLP
    stale: stalePages.length,
    empty: emptyPages.length,
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

  const lines: string[] = [
    `# 🔍 Lint Report`,
    '',
    `**${summary.total} issue(s)** — ${summary.warnings} warning(s), ${summary.info} info`,
    '',
  ];

  if (summary.brokenLinks > 0) {
    lines.push(`## ⚠️ Broken Wikilinks (${summary.brokenLinks})`, '');
    for (const issue of issues.filter((i) => i.type === 'broken_link')) {
      lines.push(`- \`${issue.page}\`: ${issue.message}`);
    }
    lines.push('');
  }

  if (summary.orphans > 0) {
    lines.push(`## 🔗 Orphan Pages (${summary.orphans})`, '');
    for (const issue of issues.filter((i) => i.type === 'orphan')) {
      lines.push(`- \`${issue.page}\`: ${issue.message}`);
    }
    lines.push('');
  }

  if (summary.empty > 0) {
    lines.push(`## 📭 Empty Pages (${summary.empty})`, '');
    for (const issue of issues.filter((i) => i.type === 'empty')) {
      lines.push(`- \`${issue.page}\`: ${issue.message}`);
    }
    lines.push('');
  }

  if (summary.stale > 0) {
    lines.push(`## ⏰ Stale Pages (${summary.stale})`, '');
    for (const issue of issues.filter((i) => i.type === 'stale')) {
      lines.push(`- \`${issue.page}\`: ${issue.message}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
