import { describe, expect, it } from 'vitest';

describe('guardrails extension', () => {
  it('should export a default function', async () => {
    const mod = await import('../index.ts');
    expect(typeof mod.default).toBe('function');
  });

  it('should have correct defaults structure', async () => {
    const mod = await import('../defaults.ts');
    expect(Array.isArray(mod.default)).toBe(true);
    expect(mod.default.length).toBeGreaterThan(0);

    const first = mod.default[0];
    expect(first).toHaveProperty('group');
    expect(first).toHaveProperty('pattern');
    expect(first).toHaveProperty('rules');
    expect(Array.isArray(first.rules)).toBe(true);
  });

  it('defaults should have dangerous rules', async () => {
    const mod = await import('../defaults.ts');
    const dangerous = mod.default.find((g) => g.group === 'dangerous');
    expect(dangerous).toBeDefined();
    expect(dangerous?.rules.length).toBeGreaterThan(0);
  });
});
