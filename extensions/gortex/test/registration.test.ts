import { beforeEach, describe, expect, it, vi } from 'vitest';

const { runGortex } = vi.hoisted(() => ({ runGortex: vi.fn(() => 'result') }));
vi.mock('../daemon', () => ({ runGortex, ensureDaemon: vi.fn() }));

import { coerceParams, isGortexTool, piToolName, registerGortexTools } from '../registration';
import { PUBLIC_TOOLS } from '../registry';

function makePi() {
  const tools: any[] = [];
  return {
    tools,
    registerTool: vi.fn((def: any) => tools.push(def)),
    on: vi.fn(),
  };
}

describe('registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runGortex.mockReturnValue('result');
  });

  it('piToolName prefixes bare names, idempotent for prefixed', () => {
    expect(piToolName('read')).toBe('gortex_read');
    expect(piToolName('gortex_read')).toBe('gortex_read');
  });

  it('registers all public tools under gortex_ prefix', () => {
    const pi = makePi();
    registerGortexTools(pi as any);
    expect(pi.tools.length).toBe(PUBLIC_TOOLS.length);
    expect(pi.tools.every((t) => t.name.startsWith('gortex_'))).toBe(true);
    expect(isGortexTool('gortex_read')).toBe(true);
    expect(isGortexTool('read')).toBe(false);
  });

  it('tolerates a redundant registration (config reload)', () => {
    const pi = makePi();
    (pi.registerTool as any).mockImplementationOnce(() => {
      throw new Error('dup');
    });
    expect(() => registerGortexTools(pi as any)).not.toThrow();
  });

  it('execute shells gortex call with coerced params', async () => {
    const pi = makePi();
    registerGortexTools(pi as any);
    const tool = pi.tools.find((t) => t.name === 'gortex_read') as {
      execute: (id: string, params: Record<string, unknown>) => Promise<{ content: unknown[] }>;
    };
    await tool.execute('id', { operation: 'source', target: '{"symbol":"x"}' });
    expect(runGortex).toHaveBeenCalledTimes(1);
    const args = runGortex.mock.calls[0][0] as string[];
    expect(args[0]).toBe('call');
    expect(args[1]).toBe('read');
    expect(args[2]).toBe('--json');
    const arg = JSON.parse(args[3]);
    expect(arg.target).toEqual({ symbol: 'x' });
  });

  it('coerceParams re-parses stringified objects/arrays', () => {
    expect(coerceParams({ target: '{"symbol":"x"}', list: '[1,2]' })).toEqual({
      target: { symbol: 'x' },
      list: [1, 2],
    });
  });

  it('coerceParams leaves plain strings and non-JSON alone', () => {
    expect(coerceParams({ operation: 'source', q: '{not json' })).toEqual({
      operation: 'source',
      q: '{not json',
    });
  });
});
