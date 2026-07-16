import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type AccessConfig, loadConfig } from '../lib/config';
import { registerWebFetch } from '../tools/web-fetch';

let config: AccessConfig;
let _crawlReachable = false;

beforeAll(async () => {
  config = loadConfig();
  _crawlReachable = await isReachable(config.crawl4aiBase);
});

async function isReachable(baseUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('timeout'), 5000);
    const res = await fetch(baseUrl, { signal: controller.signal, redirect: 'follow' });
    clearTimeout(timer);
    return res.ok || res.status === 307;
  } catch {
    return false;
  }
}

function createToolRecorder(c: AccessConfig) {
  const tools: Record<
    string,
    { execute: (...args: unknown[]) => Promise<Record<string, unknown>> }
  > = {};
  const pi = {
    registerTool(def: {
      name: string;
      execute: (...args: unknown[]) => Promise<Record<string, unknown>>;
    }) {
      tools[def.name] = def;
    },
  } as unknown as Parameters<typeof registerWebFetch>[0];

  registerWebFetch(pi, c);
  return tools;
}

describe('web-fetch-docs kbRoot integration (live)', { skip: true }, () => {
  let tmpRoot: string;
  let kbRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'kbroot-live-'));
    kbRoot = join(tmpRoot, '.kb');
    mkdirSync(join(kbRoot, 'raw', 'sources'), { recursive: true });
  });

  afterEach(() => {
    if (tmpRoot && existsSync(tmpRoot) && !process.env.KEEP_KBROOT_TMP) {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('crawls wiki.hypr.land/Configuring/Basics/Binds and writes source packets', {
    timeout: 120_000,
  }, async () => {
    const tools = createToolRecorder(config);
    const label = `hyprland-binds-${Date.now()}`;

    const result = await tools['web-fetch-docs'].execute('tc-1', {
      baseUrl: 'https://wiki.hypr.land/Configuring/Basics/Binds/',
      label,
      depth: 2,
      chunkIndex: 0,
      kbRoot,
    });

    expect(result.isError).toBeFalsy();
    expect(result.details?.kbRoot).toBe(kbRoot);
    expect((result.details?.kbPacketsCreated as number) ?? 0).toBeGreaterThan(0);

    const packets = readdirSync(join(kbRoot, 'raw', 'sources'))
      .filter((d) => d.startsWith('SRC-'))
      .sort();
    expect(packets.length).toBeGreaterThan(0);

    const first = packets[0];
    const manifestPath = join(kbRoot, 'raw', 'sources', first, 'manifest.json');
    expect(existsSync(manifestPath)).toBe(true);
    const m = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    expect(m.type).toBe('url');
    expect(m.status).toBe('pending');
    expect(m.url).toMatch(/^https:\/\/wiki\.hypr\.land\//);

    const extractedPath = join(kbRoot, 'raw', 'sources', first, 'extracted.md');
    expect(existsSync(extractedPath)).toBe(true);
    const content = readFileSync(extractedPath, 'utf-8');
    expect(content.length).toBeGreaterThan(100);

    const originalPath = join(kbRoot, 'raw', 'sources', first, 'original', 'url.txt');
    expect(existsSync(originalPath)).toBe(true);
    expect(readFileSync(originalPath, 'utf-8')).toMatch(/^https:\/\/wiki\.hypr\.land\//);

    console.log(
      `[kbroot-live] ${packets.length} source packets created ` +
        `(details.kbPacketsCreated=${result.details?.kbPacketsCreated}, ` +
        `skipped=${result.details?.kbPacketsSkipped}, ` +
        `totalChunks=${result.details?.totalChunks}, ` +
        `totalTokens=${result.details?.totalTokens})`
    );
    for (const id of packets.slice(0, 5)) {
      const mm = JSON.parse(
        readFileSync(join(kbRoot, 'raw', 'sources', id, 'manifest.json'), 'utf-8')
      );
      console.log(`  ${id}  ${mm.tokens} tok  ${mm.title}  ${mm.url}`);
    }
    if (packets.length > 5) console.log(`  ... (+${packets.length - 5} more)`);
  });
});
