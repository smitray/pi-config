import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(() => '  raw\n'),
  spawn: vi.fn(() => ({ on: vi.fn(), unref: vi.fn() })),
}));

import { execFileSync, spawn } from 'node:child_process';
import { ensureDaemon, runGortex } from '../daemon';

describe('daemon', () => {
  beforeEach(() => vi.clearAllMocks());

  it('runGortex returns trimmed stdout', () => {
    expect(runGortex(['call', 'read', '--json', '{}'])).toBe('raw');
    expect(execFileSync).toHaveBeenCalledWith(
      expect.any(String),
      ['call', 'read', '--json', '{}'],
      expect.objectContaining({ encoding: 'utf8' })
    );
  });

  it('ensureDaemon spawns the daemon detached and never throws', () => {
    expect(() => ensureDaemon()).not.toThrow();
    expect(spawn).toHaveBeenCalled();
  });

  it('ensureDaemon swallows spawn failure', () => {
    vi.mocked(spawn).mockImplementationOnce(() => {
      throw new Error('boom');
    });
    expect(() => ensureDaemon()).not.toThrow();
  });
});
