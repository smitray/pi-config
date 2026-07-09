import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Real fs, real temp dir — exercises the settings.json config I/O + migration.
// render.test.ts mocks fs to no-ops, so it can't cover this path.
import { mergeFooterConfig, readConfig, writeConfig } from '../index';

describe('better-footer config I/O', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'bf-cfg-'));
  });

  it('seeds DEFAULT_CONFIG into settings.json on first run when nothing exists', () => {
    const cfg = readConfig(dir);
    expect(cfg.enabled).toBe(true);
    expect(cfg.promptSymbol).toBe('\u25c9');
    // settings.json was created with a betterFooter key
    const settings = JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf-8'));
    expect(settings.betterFooter).toBeDefined();
    expect(settings.betterFooter.enabled).toBe(true);
    // no legacy file was created
    expect(existsSync(join(dir, 'better-footer.json'))).toBe(false);
  });

  it('preserves other settings keys when writing footer config', () => {
    // pre-populate settings.json with unrelated keys
    writeFileSync(
      join(dir, 'settings.json'),
      `${JSON.stringify({ theme: 'catppuccin-mocha', kb: { autoIngest: true } }, null, 2)}\n`
    );
    const cfg = mergeFooterConfig({ enabled: false });
    writeConfig(cfg, dir);
    const after = JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf-8'));
    expect(after.theme).toBe('catppuccin-mocha');
    expect(after.kb.autoIngest).toBe(true);
    expect(after.betterFooter.enabled).toBe(false);
  });

  it('migrates legacy better-footer.json into settings.json and deletes the legacy file', () => {
    // legacy standalone config
    writeFileSync(
      join(dir, 'better-footer.json'),
      `${JSON.stringify({ enabled: true, promptSymbol: 'X', metrics: { cwd: { color: 'error' } } })}\n`
    );
    // pre-existing settings.json with other keys
    writeFileSync(join(dir, 'settings.json'), `${JSON.stringify({ theme: 'dark' }, null, 2)}\n`);

    const cfg = readConfig(dir);
    expect(cfg.enabled).toBe(true);
    expect(cfg.promptSymbol).toBe('X');
    expect(cfg.metrics.cwd?.color).toBe('error');

    // legacy file removed
    expect(existsSync(join(dir, 'better-footer.json'))).toBe(false);
    // settings.json gained betterFooter, kept theme
    const after = JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf-8'));
    expect(after.theme).toBe('dark');
    expect(after.betterFooter.enabled).toBe(true);
  });

  it('is idempotent: existing betterFooter wins, legacy file still removed, no overwrite', () => {
    // settings.json already has a betterFooter key
    writeFileSync(
      join(dir, 'settings.json'),
      `${JSON.stringify({ betterFooter: { enabled: false, promptSymbol: 'KEEP' } }, null, 2)}\n`
    );
    // legacy file with DIFFERENT values should NOT overwrite
    writeFileSync(
      join(dir, 'better-footer.json'),
      `${JSON.stringify({ enabled: true, promptSymbol: 'LEGACY' })}\n`
    );

    const cfg = readConfig(dir);
    expect(cfg.enabled).toBe(false); // settings.json wins, not legacy
    expect(cfg.promptSymbol).toBe('KEEP');

    // legacy still removed even when not used for migration
    expect(existsSync(join(dir, 'better-footer.json'))).toBe(false);
    const after = JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf-8'));
    expect(after.betterFooter.enabled).toBe(false);
    expect(after.betterFooter.promptSymbol).toBe('KEEP');
  });

  it('survives a corrupted settings.json by falling back to defaults', () => {
    writeFileSync(join(dir, 'settings.json'), '{ not valid json');
    const cfg = readConfig(dir);
    expect(cfg.enabled).toBe(true); // DEFAULT_CONFIG
    expect(cfg.promptSymbol).toBe('\u25c9');
  });

  // Clean up each test's temp dir
  afterEach(() => {
    if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  });
});
