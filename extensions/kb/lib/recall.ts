import { join } from 'node:path';
import type { RegistryEntry } from './metadata';
import type { VaultPaths } from './vault';
import { readJson } from './vault';

// ponytail: simple token-overlap search on titles + tags.
// Dual-mode: context (project first) vs docs (personal first).
// No embeddings — YAGNI until vault hits 1000+ pages.

export type RecallMode = 'context' | 'docs';

export interface RecallResult {
  id: string;
  path: string;
  title: string;
  type: string;
  tags: string[];
  stage: string;
  score: number;
  vault: 'project' | 'personal';
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\-_.,;:!?()[\]{}]+/)
    .filter((t) => t.length > 1);
}

function scoreEntry(entry: RegistryEntry, queryTokens: string[]): number {
  const titleTokens = tokenize(entry.title);
  const tagTokens = entry.tags.flatMap((t) => tokenize(t));
  const allTokens = [...titleTokens, ...tagTokens];
  const uniqueTokens = new Set(allTokens);

  let score = 0;
  for (const qt of queryTokens) {
    for (const t of uniqueTokens) {
      if (t === qt) score += 3;
      else if (t.includes(qt) || qt.includes(t)) score += 1;
    }
  }
  // Title match bonus
  if (titleTokens.some((t) => queryTokens.includes(t))) score += 2;
  // Tag match bonus
  if (tagTokens.some((t) => queryTokens.includes(t))) score += 1;
  return score;
}

function searchVault(
  paths: VaultPaths,
  queryTokens: string[],
  vaultLabel: 'project' | 'personal'
): RecallResult[] {
  const registryPath = join(paths.meta, 'registry.json');
  const registry = readJson<RegistryEntry[]>(registryPath) || [];

  return registry
    .map((entry) => ({
      id: entry.id,
      path: entry.path,
      title: entry.title,
      type: entry.type,
      tags: entry.tags,
      stage: entry.stage,
      score: scoreEntry(entry, queryTokens),
      vault: vaultLabel,
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function searchWiki(
  projectPaths: VaultPaths | null,
  personalPaths: VaultPaths,
  query: string,
  mode: RecallMode,
  maxResults = 5
): RecallResult[] {
  const queryTokens = tokenize(query);
  const projectResults = projectPaths ? searchVault(projectPaths, queryTokens, 'project') : [];
  const personalResults = searchVault(personalPaths, queryTokens, 'personal');

  // Deduplicate by id (project wins on collision)
  const seen = new Set<string>();
  const merged: RecallResult[] = [];

  const first = mode === 'context' ? projectResults : personalResults;
  const second = mode === 'context' ? personalResults : projectResults;

  for (const r of first) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      merged.push(r);
    }
  }
  for (const r of second) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      merged.push(r);
    }
  }

  return merged.slice(0, maxResults);
}

// ─── Tag/Type/Stage search ───────────────────────────────────

function readVaultEntries(paths: VaultPaths, vaultLabel: 'project' | 'personal'): RecallResult[] {
  const registry = readJson<RegistryEntry[]>(join(paths.meta, 'registry.json')) || [];
  return registry.map((e) => ({
    id: e.id,
    path: e.path,
    title: e.title,
    type: e.type,
    tags: e.tags,
    stage: e.stage,
    score: 0,
    vault: vaultLabel,
  }));
}

export interface TagFilters {
  tag?: string;
  type?: string;
  stage?: string;
}

function matchesFilter(result: RecallResult, filters: TagFilters): boolean {
  if (
    filters.tag &&
    !result.tags.some((t) => t.toLowerCase().includes(filters.tag?.toLowerCase() ?? ''))
  ) {
    return false;
  }
  if (filters.type && result.type !== filters.type) return false;
  if (filters.stage && result.stage !== filters.stage) return false;
  return true;
}

export function searchByTag(
  projectPaths: VaultPaths | null,
  personalPaths: VaultPaths,
  filters: TagFilters
): RecallResult[] {
  if (!filters.tag && !filters.type && !filters.stage) return [];

  const projectEntries = projectPaths ? readVaultEntries(projectPaths, 'project') : [];
  const personalEntries = readVaultEntries(personalPaths, 'personal');

  const all = [...projectEntries, ...personalEntries].filter((r) => matchesFilter(r, filters));

  // Deduplicate by id (project wins)
  const seen = new Set<string>();
  const deduped: RecallResult[] = [];
  for (const r of all) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      deduped.push(r);
    }
  }
  return deduped;
}

export function formatRecallResults(results: RecallResult[]): string {
  if (results.length === 0) return '';

  const lines = ['## Relevant Wiki Knowledge\n'];
  for (const r of results) {
    const label = r.vault === 'personal' ? '📓 personal' : '📁 project';
    const extras: string[] = [];
    if (r.stage) extras.push(r.stage);
    if (r.tags.length > 0) extras.push(...r.tags.slice(0, 3));
    const extra = extras.length > 0 ? ` [${extras.join(', ')}]` : '';
    lines.push(`- [${label}] [[${r.id}]] — ${r.title} (${r.type}${extra})`);
  }
  return lines.join('\n');
}
