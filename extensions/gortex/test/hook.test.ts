import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(() => JSON.stringify({ block: true, reason: 'nope' })),
}));

import { execFileSync } from 'node:child_process';
import { callHook } from '../hook';

describe('hook.callHook', () => {
  beforeEach(() => vi.clearAllMocks());

  it('parses a PiDecision from hook stdout', () => {
    const d = callHook({ event: 'tool_call' });
    expect(d.block).toBe(true);
    expect(execFileSync).toHaveBeenCalled();
  });

  it('returns {} on empty output (fail-open)', () => {
    vi.mocked(execFileSync).mockReturnValueOnce('' as any);
    expect(callHook({})).toEqual({});
  });

  it('returns {} on throw (fail-open)', () => {
    vi.mocked(execFileSync).mockImplementationOnce(() => {
      throw new Error('x');
    });
    expect(callHook({})).toEqual({});
  });
});
