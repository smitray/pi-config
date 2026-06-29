import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
    writeFileSync(join(home, '.kb', 'config.json'), '{"mode":"personal"}', { recursive: true });
    const projectRoot = join(tmpRoot, 'project');
    writeFileSync(join(projectRoot, '.kb', 'config.json'), '{"mode":"project"}', { recursive: true });

    // From inside a project, request personal
    const paths = getExplicitVaultPaths('personal', projectRoot);
    expect(paths.root).toBe(home);
    expect(paths.dotKb).toBe(join(home, '.kb'));
  });

  it('getExplicitVaultPaths(project) walks up from cwd to find project marker', () => {
    const projectRoot = join(tmpRoot, 'myapp');
    writeFileSync(join(projectRoot, '.git', 'HEAD'), 'ref: refs/heads/main', { recursive: true });
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