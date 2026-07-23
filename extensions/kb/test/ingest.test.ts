import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getUningestedSources, markSourceIngested } from '../lib/ingest';
import { buildVaultPaths, ensureVaultStructure, fmtDate, writeJson } from '../lib/vault';

const TMP = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.kb-test-ingest');
const paths = buildVaultPaths(TMP);

beforeEach(() => {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  ensureVaultStructure(paths);
  writeJson(join(paths.dotKb, 'config.json'), {
    topic: 'test',
    mode: 'project',
    created: fmtDate(),
    version: '1.0',
  });
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

function createFakeSource(sourceId: string) {
  const dir = join(paths.raw, 'sources', sourceId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'manifest.json'),
    JSON.stringify({
      sourceId,
      title: `Source ${sourceId}`,
      type: 'text',
      captured: '2026-07-23',
      status: 'pending',
    })
  );
  writeFileSync(join(dir, 'extracted.md'), 'extracted content');
}

describe('getUningestedSources', () => {
  it('returns empty when no sources exist', () => {
    const sources = getUningestedSources(paths);
    expect(sources).toHaveLength(0);
  });

  it('returns pending sources', () => {
    createFakeSource('SRC-2026-07-23-001');
    createFakeSource('SRC-2026-07-23-002');

    const sources = getUningestedSources(paths);
    expect(sources).toHaveLength(2);
    expect(sources[0].sourceId).toBe('SRC-2026-07-23-001');
    expect(sources[1].status).toBe('pending');
  });
});

describe('markSourceIngested', () => {
  it('marks a source as ingested', () => {
    createFakeSource('SRC-2026-07-23-003');
    const result = markSourceIngested('SRC-2026-07-23-003', paths);
    expect(result).toBe(true);

    const sources = getUningestedSources(paths);
    expect(sources).toHaveLength(0);
  });

  it('returns false for non-existent source', () => {
    const result = markSourceIngested('SRC-NONEXISTENT', paths);
    expect(result).toBe(false);
  });
});
