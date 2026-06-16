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
});
