import { describe, expect, it } from 'vitest';
import { normalizeToolCall } from '../hook';

describe('normalizeToolCall', () => {
  it('maps read file_path -> Read', () => {
    const r = normalizeToolCall('read', { file_path: '/a/b.ts' });
    expect(r.tool_name).toBe('Read');
    expect((r.tool_input as any).file_path).toBe('/a/b.ts');
  });

  it('maps grep pattern -> Grep', () => {
    const r = normalizeToolCall('grep', { pattern: 'foo' });
    expect(r.tool_name).toBe('Grep');
    expect((r.tool_input as any).pattern).toBe('foo');
  });

  it('maps find path -> Glob with pattern=path', () => {
    const r = normalizeToolCall('find', { path: '/x' });
    expect(r.tool_name).toBe('Glob');
    expect((r.tool_input as any).pattern).toBe('/x');
  });

  it('maps bash command -> Bash', () => {
    const r = normalizeToolCall('bash', { command: 'ls' });
    expect(r.tool_name).toBe('Bash');
    expect((r.tool_input as any).command).toBe('ls');
  });

  it('passes unknown tools through unchanged', () => {
    const r = normalizeToolCall('weird', { a: 1 });
    expect(r.tool_name).toBe('weird');
  });
});
