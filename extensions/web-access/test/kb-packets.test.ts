import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writePagesAsKbPackets } from '../lib/kb-packets';

let tmpRoot: string;
let kbRoot: string;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'kb-packets-test-'));
  kbRoot = join(tmpRoot, '.kb');
  mkdirSync(join(kbRoot, 'raw', 'sources'), { recursive: true });
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe('writePagesAsKbPackets', () => {
  it('creates one packet per page', () => {
    const packets = writePagesAsKbPackets(
      [
        {
          url: 'https://wiki.hypr.land/Getting-Started/',
          title: 'Getting Started',
          markdown: '# Getting Started\n\nWelcome to Hyprland.',
        },
        {
          url: 'https://wiki.hypr.land/Configuration/',
          title: 'Configuration',
          markdown: '# Configuration\n\nEdit ~/.config/hypr/hyprland.conf',
        },
      ],
      kbRoot
    );

    expect(packets).toHaveLength(2);
    expect(packets[0].skipped).toBeFalsy();
    expect(packets[0].sourceId).toMatch(/^SRC-\d{4}-\d{2}-\d{2}-001$/);
    expect(packets[1].sourceId).toMatch(/^SRC-\d{4}-\d{2}-\d{2}-002$/);

    for (const p of packets) {
      expect(existsSync(join(p.packetDir, 'original', 'url.txt'))).toBe(true);
      expect(existsSync(join(p.packetDir, 'extracted.md'))).toBe(true);
      expect(existsSync(join(p.packetDir, 'manifest.json'))).toBe(true);

      const url = readFileSync(join(p.packetDir, 'original', 'url.txt'), 'utf-8');
      expect(url).toMatch(/^https:\/\/wiki\.hypr\.land\//);

      const manifest = JSON.parse(readFileSync(join(p.packetDir, 'manifest.json'), 'utf-8'));
      expect(manifest.type).toBe('url');
      expect(manifest.status).toBe('pending');
      expect(manifest.url).toMatch(/^https:\/\//);
      expect(manifest.tokens).toBeGreaterThan(0);
    }
  });

  it('dedups by URL on re-crawl (skips existing packets)', () => {
    const pages = [
      { url: 'https://a.com/x', title: 'X', markdown: '# X' },
      { url: 'https://a.com/y', title: 'Y', markdown: '# Y' },
    ];
    writePagesAsKbPackets(pages, kbRoot);

    // Re-crawl: same URLs, should skip both
    const second = writePagesAsKbPackets(pages, kbRoot);
    expect(second).toHaveLength(2);
    expect(second[0].skipped).toBe(true);
    expect(second[1].skipped).toBe(true);
    expect(second[0].sourceId).toMatch(/^SRC-\d{4}-\d{2}-\d{2}-001$/);

    // Should still have only 2 packets on disk
    const dirs = existsSync(join(kbRoot, 'raw', 'sources'))
      ? require('node:fs').readdirSync(join(kbRoot, 'raw', 'sources'))
      : [];
    expect(dirs.filter((d: string) => d.startsWith('SRC-'))).toHaveLength(2);
  });

  it('increments NNN across multiple calls in same session', () => {
    writePagesAsKbPackets([{ url: 'https://a.com/x', title: 'X', markdown: '# X' }], kbRoot);
    writePagesAsKbPackets([{ url: 'https://a.com/y', title: 'Y', markdown: '# Y' }], kbRoot);
    const fs = require('node:fs') as typeof import('node:fs');
    const list = fs
      .readdirSync(join(kbRoot, 'raw', 'sources'))
      .filter((d: string) => d.startsWith('SRC-'))
      .sort();
    expect(list).toHaveLength(2);
    expect(list[0]).toMatch(/-001$/);
    expect(list[1]).toMatch(/-002$/);
  });

  it('handles empty input', () => {
    const packets = writePagesAsKbPackets([], kbRoot);
    expect(packets).toEqual([]);
  });

  it('marks chunked=true when content exceeds 4000 tokens', () => {
    const big = 'word '.repeat(20_000); // ~5000 tokens
    const packets = writePagesAsKbPackets(
      [{ url: 'https://a.com/big', title: 'Big', markdown: big }],
      kbRoot
    );
    expect(packets[0].skipped).toBeFalsy();
    const manifest = JSON.parse(readFileSync(join(packets[0].packetDir, 'manifest.json'), 'utf-8'));
    expect(manifest.chunked).toBe(true);
  });
});
