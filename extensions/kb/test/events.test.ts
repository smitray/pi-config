import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { logEvent } from '../lib/events';
import type { VaultPaths } from '../lib/vault';

const TEST_DIR = join(import.meta.dirname, '.tmp-events-test');

function makePaths(): VaultPaths {
  return {
    dotKb: TEST_DIR,
    raw: join(TEST_DIR, 'raw'),
    wiki: join(TEST_DIR, 'wiki'),
    meta: join(TEST_DIR, 'meta'),
    templates: join(TEST_DIR, 'templates', 'pages'),
  };
}

beforeEach(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
});

describe('logEvent', () => {
  it('creates events.jsonl and appends entry', () => {
    const paths = makePaths();
    mkdirSync(paths.meta, { recursive: true });

    logEvent(paths, { kind: 'test_event' });

    const content = readFileSync(join(paths.meta, 'events.jsonl'), 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(1);

    const entry = JSON.parse(lines[0]);
    expect(entry.kind).toBe('test_event');
    expect(entry.timestamp).toBeDefined();
  });

  it('includes additional data', () => {
    const paths = makePaths();
    mkdirSync(paths.meta, { recursive: true });

    logEvent(paths, {
      kind: 'ingest',
      data: { sourceId: 'SRC-001', title: 'Test Source' },
    });

    const content = readFileSync(join(paths.meta, 'events.jsonl'), 'utf-8');
    const entry = JSON.parse(content.trim());

    expect(entry.kind).toBe('ingest');
    expect(entry.sourceId).toBe('SRC-001');
    expect(entry.title).toBe('Test Source');
  });

  it('appends multiple entries', () => {
    const paths = makePaths();
    mkdirSync(paths.meta, { recursive: true });

    logEvent(paths, { kind: 'event1' });
    logEvent(paths, { kind: 'event2' });
    logEvent(paths, { kind: 'event3' });

    const content = readFileSync(join(paths.meta, 'events.jsonl'), 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(3);

    expect(JSON.parse(lines[0]).kind).toBe('event1');
    expect(JSON.parse(lines[1]).kind).toBe('event2');
    expect(JSON.parse(lines[2]).kind).toBe('event3');
  });

  it('creates meta directory if it does not exist', () => {
    const paths = makePaths();

    logEvent(paths, { kind: 'first_event' });

    expect(existsSync(join(paths.meta, 'events.jsonl'))).toBe(true);
  });
});
