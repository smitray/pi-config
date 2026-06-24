import { describe, expect, it } from 'vitest';
import { runHooks } from '../engine/hook-execution';
import type { HooksConfig } from '../types/schema';

describe('runHooks', () => {
  it('should run matching hooks', async () => {
    const config: HooksConfig = [
      {
        group: 'test',
        pattern: '*',
        hooks: [
          {
            event: 'session_start',
            command: 'echo "hello"',
            notify: true,
          },
        ],
      },
    ];
    const result = await runHooks(config, 'session_start', { cwd: '/tmp' });
    expect(result.block).toBeUndefined();
  });

  it('should skip non-matching events', async () => {
    const config: HooksConfig = [
      {
        group: 'test',
        pattern: '*',
        hooks: [
          {
            event: 'session_start',
            command: 'exit 2',
          },
        ],
      },
    ];
    const result = await runHooks(config, 'tool_call', { cwd: '/tmp' });
    expect(result.block).toBeUndefined();
  });

  it('should block on exit code 2', async () => {
    const config: HooksConfig = [
      {
        group: 'test',
        pattern: '*',
        hooks: [
          {
            event: 'tool_call',
            command: 'exit 2',
          },
        ],
      },
    ];
    const result = await runHooks(config, 'tool_call', { cwd: '/tmp' });
    expect(result.block).toBe(true);
    expect(result.reason).toBeDefined();
  });

  it('blocks via JSON decision when exit 0', async () => {
    const config: HooksConfig = [
      {
        group: 'test',
        pattern: '*',
        hooks: [
          {
            event: 'tool_call',
            command: 'printf \'%s\' \'{"decision":"block","reason":"nope"}\'',
          },
        ],
      },
    ];
    const result = await runHooks(config, 'tool_call', { cwd: '/tmp' });
    expect(result.block).toBe(true);
    expect(result.reason).toBe('nope');
  });

  it('returns systemMessage when notify=true and hook emits one', async () => {
    const config: HooksConfig = [
      {
        group: 'test',
        pattern: '*',
        hooks: [
          {
            event: 'session_start',
            command: 'printf \'%s\' \'{"systemMessage":"hook ran"}\'',
            notify: true,
          },
        ],
      },
    ];
    const result = await runHooks(config, 'session_start', { cwd: '/tmp' });
    expect(result.messages).toContain('hook ran');
  });

  it('substitutes %file% with the file path', async () => {
    const config: HooksConfig = [
      {
        group: 'capture',
        pattern: '*',
        hooks: [
          {
            event: 'tool_call',
            command: 'echo "%file%" > /tmp/hook-test-file.txt',
          },
        ],
      },
    ];
    await runHooks(
      config,
      'tool_call',
      { cwd: '/tmp' },
      { toolName: 'edit', input: { path: '/tmp/hook-test-source.ts' } }
    );
    const { readFileSync, rmSync } = await import('node:fs');
    const written = readFileSync('/tmp/hook-test-file.txt', 'utf-8').trim();
    expect(written).toBe('/tmp/hook-test-source.ts');
    rmSync('/tmp/hook-test-file.txt', { force: true });
  });

  it('does NOT populate %file% for bash commands (use %command%)', async () => {
    const config: HooksConfig = [
      {
        group: 'capture',
        pattern: '*',
        hooks: [
          {
            event: 'tool_call',
            command: 'echo "file=[%file%] cmd=[%command%]" > /tmp/hook-test-bash.txt',
          },
        ],
      },
    ];
    await runHooks(
      config,
      'tool_call',
      { cwd: '/tmp' },
      { toolName: 'bash', input: { command: 'rm -rf /tmp/foo' } }
    );
    const { readFileSync, rmSync } = await import('node:fs');
    const written = readFileSync('/tmp/hook-test-bash.txt', 'utf-8').trim();
    // %file% should be empty (bash has no path), %command% should be the command.
    expect(written).toBe('file=[] cmd=[rm -rf /tmp/foo]');
    rmSync('/tmp/hook-test-bash.txt', { force: true });
  });
});
