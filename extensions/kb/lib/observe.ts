import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { VaultPaths } from './vault';
import { fmtDate } from './vault';

export interface ObservationInput {
  title: string;
  content: string;
  relevance: 'low' | 'medium' | 'high' | 'critical';
  tags?: string[];
  sourceContext?: string;
}

export interface ObservationResult {
  sourceId: string;
  pagePath: string;
}

/**
 * Save an observation as a wiki source page.
 *
 * Observations are lightweight captures for mid-session knowledge.
 * Unlike kb_capture (full source packet), this writes a single markdown
 * file to wiki/sources/ with status: observation.
 *
 * ponytail: single file, no source packet overhead. Observations are
 * searchable via kb_recall_* and can be integrated into canonical pages later.
 */
export function saveObservation(paths: VaultPaths, input: ObservationInput): ObservationResult {
  const today = fmtDate();
  const slug = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

  const sourceId = `OBS-${today}-${slug}`;

  const tags = input.tags || [];
  const tagsYaml = tags.length > 0 ? `[${tags.map((t) => `"${t}"`).join(', ')}]` : '[]';

  const lines = [
    '---',
    'type: source',
    `title: "${input.title}"`,
    `slug: ${slug}`,
    'status: observation',
    `relevance: ${input.relevance}`,
    `created: ${today}`,
    `updated: ${today}`,
    `tags: ${tagsYaml}`,
    '---',
    '',
    `# ${input.title}`,
    '',
    '## Observation',
    '',
    input.content,
  ];

  if (input.sourceContext) {
    lines.push('', '## Context', '', input.sourceContext);
  }

  const sourceDir = join(paths.wiki, 'sources');
  mkdirSync(sourceDir, { recursive: true });

  const filename = `${slug}.md`;
  const pagePath = join(sourceDir, filename);
  writeFileSync(pagePath, lines.join('\n'), 'utf-8');

  return { sourceId, pagePath };
}

/**
 * Format observation result for display.
 */
export function formatObservationResult(result: ObservationResult, title: string): string {
  return [
    `✅ Observation saved: \`${result.sourceId}\` — ${title}`,
    `Stored: \`${result.pagePath}\``,
    '',
    'Observations are searchable via `kb_recall_*` and can be integrated into canonical pages later.',
  ].join('\n');
}
