import { describe, expect, it } from 'vitest';
import { spawnErrorMessage } from '../api/gh';

describe('spawnErrorMessage', () => {
  it('returns error when spawn itself failed', () => {
    const r = {
      ok: false,
      stdout: '',
      stderr: '',
      exitCode: -1,
      signal: '',
      error: 'ENOENT: gh not found',
    };
    expect(spawnErrorMessage(r)).toBe('ENOENT: gh not found');
  });

  it('returns stderr when command exited non-zero', () => {
    const r = {
      ok: false,
      stdout: '',
      stderr: 'gh: Not Found',
      exitCode: 1,
      signal: '',
      error: '',
    };
    expect(spawnErrorMessage(r)).toBe('gh: Not Found');
  });

  it('falls back to stdout when stderr is empty', () => {
    const r = {
      ok: false,
      stdout: 'partial output',
      stderr: '',
      exitCode: 2,
      signal: '',
      error: '',
    };
    expect(spawnErrorMessage(r)).toBe('partial output');
  });
});
