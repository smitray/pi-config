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
