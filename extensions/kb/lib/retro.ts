import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { VaultPaths } from './vault';
import { fmtDate } from './vault';

export interface RetroInput {
  title: string;
  body: string;
  category?: string;
}

export interface RetroResult {
  slug: string;
  pagePath: string;
}

/**
 * Save an atomic insight into the wiki as a single markdown file.
 *
 * Unlike kb_capture (full source packet with manifest.json, extracted.md,
 * and attachments), this is a lightweight path for quick knowledge capture —
 * one file, one call.
 *
 * ponytail: retro is for task-end insights. Single file, no source packet
 * overhead. Observations (kb_observe) are for mid-session captures.
 * Both are searchable via kb_recall_*.
 */
export function saveInsight(paths: VaultPaths, input: RetroInput): RetroResult {
  const today = fmtDate();
  const slug = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

  const categoryLine = input.category ? `\ncategory: ${input.category}` : '';

  const lines = [
    '---',
    'type: source',
    `title: "${input.title}"`,
    `slug: ${slug}`,
    'status: insight',
    `created: ${today}`,
    `updated: ${today}`,
    `${categoryLine}`,
    '---',
    '',
    `# ${input.title}`,
    '',
    input.body,
  ];

  const sourceDir = join(paths.wiki, 'sources');
  mkdirSync(sourceDir, { recursive: true });

  const filename = `${slug}.md`;
  const pagePath = join(sourceDir, filename);
  writeFileSync(pagePath, lines.join('\n'), 'utf-8');

  return { slug, pagePath };
}

/**
 * Format retro result for display.
 */
export function formatRetroResult(result: RetroResult, title: string): string {
  return [
    `✅ Insight saved: \`${result.slug}\` — ${title}`,
    `Stored: \`${result.pagePath}\``,
    '',
    'Insights are searchable via `kb_recall_*`.',
  ].join('\n');
}
