import { describe, expect, it } from 'vitest';

describe('notify extension', () => {
  it('should export a default function', async () => {
    const mod = await import('../index.ts');
    expect(typeof mod.default).toBe('function');
  });

  it('should register notify tool on init', async () => {
    const tools: Array<{ name: string }> = [];
    const events: string[] = [];
    const mockPi = {
      registerTool: (tool: { name: string }) => tools.push(tool),
      on: (event: string, _handler: () => void) => events.push(event),
      exec: async () => ({ code: 0, stdout: '', stderr: '' }),
    };

    const mod = await import('../index.ts');
    await mod.default(mockPi);

    const notifyTool = tools.find((t) => t.name === 'notify');
    expect(notifyTool).toBeDefined();
    expect(events).toContain('agent_settled');
    expect(events).toContain('input');
  });
});
