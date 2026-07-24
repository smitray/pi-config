import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the gortex binary so handlers run without shelling out.
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(() => '{}'),
  spawn: vi.fn(() => ({ on: vi.fn(), unref: vi.fn() })),
}));

import { execFileSync } from 'node:child_process';
import gortexExtension from '../index';

function makePi() {
  const handlers: Record<string, (...args: any[]) => any> = {};
  return {
    handlers,
    cwd: '/home/u/project',
    registerTool: vi.fn(),
    sendMessage: vi.fn(),
    on(event: string, handler: (...args: any[]) => any) {
      handlers[event] = handler;
    },
  };
}

describe('gortex extension entry point', () => {
  beforeEach(() => vi.clearAllMocks());

  it('registers lifecycle handlers without throwing', () => {
    const pi = makePi();
    expect(() => gortexExtension(pi as any)).not.toThrow();
    expect(typeof pi.handlers.session_start).toBe('function');
    expect(typeof pi.handlers.before_agent_start).toBe('function');
    expect(typeof pi.handlers.context).toBe('function');
    expect(typeof pi.handlers.tool_call).toBe('function');
  });

  it('session_start + before_agent_start + tool_call run without ReferenceErrors', () => {
    const pi = makePi();
    gortexExtension(pi as any);
    expect(() => pi.handlers.session_start()).not.toThrow();
    // before_agent_start calls callHook — this previously threw
    // "callHook is not defined" after the enforcement logic moved to hook.ts.
    expect(() => pi.handlers.before_agent_start()).not.toThrow();
    expect(() =>
      pi.handlers.tool_call({ toolName: 'grep', input: { pattern: 'x' } }, { cwd: '/x' })
    ).not.toThrow();
    // orientation fetch + tool_call evaluation both hit the hook binary
    expect(execFileSync).toHaveBeenCalled();
  });

  it('exposes skills via resources_discover', () => {
    const pi = makePi();
    gortexExtension(pi as any);
    expect(typeof pi.handlers.resources_discover).toBe('function');
    const res = pi.handlers.resources_discover();
    expect(res.skillPaths[0]).toMatch(/extensions[\\/]gortex[\\/]skills$/);
  });

  it('context hook injects orientation exactly once', () => {
    const pi = makePi();
    gortexExtension(pi as any);
    pi.handlers.session_start();
    pi.handlers.before_agent_start();
    const event = { messages: [] as any[] };
    expect(pi.handlers.context(event)).toBeDefined();
    expect(event.messages.length).toBe(1);
    // second call clears pendingOrientation
    expect(pi.handlers.context({ messages: [] })).toBeUndefined();
  });
});
