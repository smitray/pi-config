import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { rebuildMetadata } from '../lib/metadata';
import { searchByTag } from '../lib/recall';
import { ensureVaultStructure, getVaultPaths, readJson } from '../lib/vault';

let tmpRoot: string;

function setupVault(): ReturnType<typeof getVaultPaths> {
  tmpRoot = mkdtempSync(join(tmpdir(), 'kb-registry-'));
  const paths = getVaultPaths(tmpRoot);
  ensureVaultStructure(paths);
  return paths;
}

function createPage(
  paths: ReturnType<typeof getVaultPaths>,
  type: string,
  name: string,
  content: string
) {
  const dir = join(paths.wiki, `${type}s`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.md`), content);
}

function cleanup() {
  if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
}

describe('registry run/status fields', () => {
  it('rebuildMetadata writes status and run fields', () => {
    const paths = setupVault();
    createPage(
      paths,
      'concept',
      'page-one',
      [
        '---',
        'type: concept',
        'title: Page One',
        'tags: [workflow]',
        'status: done',
        'run: RUN-1',
        '---',
        'Body.',
      ].join('\n')
    );
    rebuildMetadata(paths);

    const registry = readJson<Record<string, unknown>[]>(join(paths.meta, 'registry.json')) || [];

    expect(registry.length).toBeGreaterThan(0);

    for (const e of registry) {
      expect(e).toHaveProperty('status');
      expect(e).toHaveProperty('run');
    }
    cleanup();
  });

  it('searchByTag filters by run and status', () => {
    const paths = setupVault();
    createPage(
      paths,
      'concept',
      'workflow-done',
      [
        '---',
        'type: concept',
        'title: Workflow Done',
        'tags: [workflow]',
        'status: done',
        'run: RUN-1',
        '---',
        'Body.',
      ].join('\n')
    );
    createPage(
      paths,
      'concept',
      'react-draft',
      [
        '---',
        'type: concept',
        'title: React Draft',
        'tags: [react]',
        'status: draft',
        'run: RUN-2',
        '---',
        'Body.',
      ].join('\n')
    );
    rebuildMetadata(paths);

    // Status filter matches the page with status=done
    const statusResults = searchByTag(paths, paths, { status: 'done' });
    expect(statusResults).toHaveLength(1);

    // Run filter with nonexistent value returns empty
    const runResults = searchByTag(paths, paths, { run: 'NONEXISTENT-RUN' });
    expect(runResults).toHaveLength(0);

    // Combined tag+status filter: no workflow page has status=draft
    const combined = searchByTag(paths, paths, { tag: 'workflow', status: 'draft' });
    expect(combined).toHaveLength(0);

    // Tag filter works and returns objects with status/run fields
    const tagResults = searchByTag(paths, paths, { tag: 'workflow' });
    expect(tagResults.length).toBeGreaterThan(0);
    for (const r of tagResults) {
      expect(r).toHaveProperty('status');
      expect(r).toHaveProperty('run');
    }
    cleanup();
  });
});
