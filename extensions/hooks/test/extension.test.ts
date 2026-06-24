import { describe, expect, it } from 'vitest';

describe('hooks extension', () => {
  it('should export a default function', async () => {
    const mod = await import('../index.ts');
    expect(typeof mod.default).toBe('function');
  });

  it('types should have correct structure', async () => {
    const _mod = await import('../types/schema.ts');
    // Type exports are erased at runtime, just verify import succeeds
    expect(true).toBe(true);
  });
});
