import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

// ponytail: vault resolution walks up for .kb/, falls back to ~/.kb/.
// Project hint: .git/ or package.json in parent chain biases toward project mode.

export interface VaultPaths {
  root: string;
  raw: string;
  rawSources: string;
  wiki: string;
  meta: string;
  dotKb: string;
  templates: string;
}

export type VaultMode = 'personal' | 'project';

export interface VaultContext {
  mode: VaultMode;
  root: string;
  isProject: boolean;
}

/** Walk up from cwd looking for .kb/ config.json */
export function resolveVaultContext(cwd: string): VaultContext {
  const kbModeEnv = process.env.KB_MODE;
  let current = cwd;

  if (kbModeEnv === 'project' || kbModeEnv === 'personal') {
    return { mode: kbModeEnv, root: cwd, isProject: kbModeEnv === 'project' };
  }

  while (true) {
    const dotKb = join(current, '.kb');
    if (existsSync(join(dotKb, 'config.json'))) {
      return { mode: 'project', root: current, isProject: true };
    }
    // Project hint: .git/ or package.json without .kb/ → still project mode
    if (existsSync(join(current, '.git')) || existsSync(join(current, 'package.json'))) {
      return { mode: 'project', root: current, isProject: true };
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  // Fallback to personal
  const home = process.env.KB_HOME || homedir();
  return { mode: 'personal', root: home, isProject: false };
}

export function getVaultPaths(root: string): VaultPaths {
  const dotKb = join(root, '.kb');
  return {
    root,
    raw: join(dotKb, 'raw'),
    rawSources: join(dotKb, 'raw', 'sources'),
    wiki: join(dotKb, 'wiki'),
    meta: join(dotKb, 'meta'),
    dotKb,
    templates: join(dotKb, 'templates', 'pages'),
  };
}

export function ensureVaultStructure(paths: VaultPaths): void {
  const dirs = [
    paths.dotKb,
    paths.templates,
    paths.raw,
    paths.rawSources,
    join(paths.wiki, 'sources'),
    join(paths.wiki, 'entities'),
    join(paths.wiki, 'concepts'),
    join(paths.wiki, 'syntheses'),
    join(paths.wiki, 'analyses'),
    paths.meta,
  ];
  for (const d of dirs) {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
  }
}

export function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return null;
  }
}

export function writeJson(path: string, data: unknown): void {
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}

export function fmtDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
