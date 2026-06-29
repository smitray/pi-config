import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getExplicitVaultPaths } from '../lib/vault';

describe('kb_ingest / kb_mark_ingested vault routing', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'kb-ingest-tool-'));
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('getExplicitVaultPaths(personal) returns personal root regardless of cwd', () => {
    // fake personal vault
    const home = join(tmpRoot, 'home');
    const homeKb = join(home, '.kb');
    if (!existsSync(homeKb)) mkdirSync(homeKb, { recursive: true });
    writeFileSync(join(homeKb, 'config.json'), '{"mode":"personal"}');
    const projectRoot = join(tmpRoot, 'project');
    const projectKb = join(projectRoot, '.kb');
    if (!existsSync(projectKb)) mkdirSync(projectKb, { recursive: true });
    writeFileSync(join(projectKb, 'config.json'), '{"mode":"project"}');

    // Set KB_HOME to point to our fake home
    const prevKBHome = process.env.KB_HOME;
    process.env.KB_HOME = home;
    try {
      // From inside a project, request personal
      const paths = getExplicitVaultPaths('personal', projectRoot);
      expect(paths.root).toBe(home);
      expect(paths.dotKb).toBe(join(home, '.kb'));
    } finally {
      process.env.KB_HOME = prevKBHome;
    }
  });

  it('getExplicitVaultPaths(project) walks up from cwd to find project marker', () => {
    const projectRoot = join(tmpRoot, 'myapp');
    const gitDir = join(projectRoot, '.git');
    if (!existsSync(gitDir)) mkdirSync(gitDir, { recursive: true });
    writeFileSync(join(gitDir, 'HEAD'), 'ref: refs/heads/main');
    const subdir = join(projectRoot, 'src', 'lib');
    const paths = getExplicitVaultPaths('project', subdir);
    expect(paths.root).toBe(projectRoot);
    expect(paths.dotKb).toBe(join(projectRoot, '.kb'));
  });

  it('getExplicitVaultPaths(project) falls back to cwd when no marker found', () => {
    const orphan = join(tmpRoot, 'orphan');
    const paths = getExplicitVaultPaths('project', orphan);
    expect(paths.root).toBe(orphan);
  });
});
