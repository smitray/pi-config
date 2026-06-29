import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { VaultPaths } from './vault';
import { fmtDate } from './vault';

export interface EnrichmentResult {
  pagePath: string;
  merged: boolean;
  message: string;
}

/**
 * Find a wiki page by title (case-insensitive slug match).
 */
export function findPageByTitle(paths: VaultPaths, title: string): string | null {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  function scanDir(dir: string): string | null {
    if (!existsSync(dir)) return null;
    const { readdirSync } = require('node:fs');
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = scanDir(full);
        if (found) return found;
      } else if (entry.name.endsWith('.md')) {
        const fileSlug = entry.name.replace(/\.md$/, '').toLowerCase();
        if (fileSlug === slug || fileSlug.includes(slug)) {
          return full;
        }
      }
    }
    return null;
  }

  return scanDir(paths.wiki);
}

/**
 * Merge observation content into an existing wiki page.
 *
 * Adds a new section at the end of the page with the observation content,
 * preserving the original as a source reference.
 */
export function mergeObservationIntoPage(
  paths: VaultPaths,
  pageTitle: string,
  observationTitle: string,
  observationContent: string,
  sourceContext?: string
): EnrichmentResult {
  const pagePath = findPageByTitle(paths, pageTitle);

  if (!pagePath) {
    return {
      pagePath: '',
      merged: false,
      message: `Page not found: ${pageTitle}`,
    };
  }

  const content = readFileSync(pagePath, 'utf-8');
  const today = fmtDate();

  // Build enrichment section
  const section = [
    '',
    `## ${observationTitle}`,
    '',
    `> **Enriched:** ${today}${sourceContext ? ` — ${sourceContext}` : ''}`,
    '',
    observationContent,
    '',
  ].join('\n');

  // Append section to page
  const updated = content + section;
  writeFileSync(pagePath, updated, 'utf-8');

  // Update frontmatter date
  const updatedContent = updated.replace(/updated:\s*\d{4}-\d{2}-\d{2}/, `updated: ${today}`);
  writeFileSync(pagePath, updatedContent, 'utf-8');

  return {
    pagePath,
    merged: true,
    message: `✅ Enriched "${pageTitle}" with "${observationTitle}"`,
  };
}

/**
 * Format enrichment result for display.
 */
export function formatEnrichmentResult(result: EnrichmentResult): string {
  if (!result.merged) {
    return `❌ ${result.message}`;
  }
  return result.message;
}
