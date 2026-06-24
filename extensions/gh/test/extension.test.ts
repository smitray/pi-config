import { describe, expect, it } from 'vitest';

describe('gh extension', () => {
  it('should export a default function', async () => {
    const mod = await import('../index.ts');
    expect(typeof mod.default).toBe('function');
  });

  it('api/gh should export gh, ghRepo, spawnErrorMessage', async () => {
    const mod = await import('../api/gh.ts');
    expect(typeof mod.gh).toBe('function');
    expect(typeof mod.ghRepo).toBe('function');
    expect(typeof mod.spawnErrorMessage).toBe('function');
  });
});
