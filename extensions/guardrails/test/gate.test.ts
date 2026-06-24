import { describe, expect, it, vi } from 'vitest';
import { setupGateHook } from '../gate';
import type { GuardrailsGroup } from '../types';

type Recorder = {
  handlers: Record<string, (event: unknown, ctx: unknown) => Promise<unknown>>;
  registerCommand: ReturnType<typeof vi.fn>;
  on: (event: string, handler: (event: unknown, ctx: unknown) => Promise<unknown>) => void;
};

function makePi(): Recorder {
  const recorder: Recorder = {
    handlers: {},
    registerCommand: vi.fn(),
    on(event, handler) {
      recorder.handlers[event] = handler;
    },
  };
  return recorder;
}

function makeCtx(opts: { hasUI?: boolean; confirm?: boolean; cwd?: string } = {}) {
  const confirm = vi.fn().mockResolvedValue(opts.confirm ?? true);
  const notify = vi.fn();
  return {
    cwd: opts.cwd ?? '/home/u/project',
    hasUI: opts.hasUI ?? true,
    ui: { confirm, notify },
    _confirm: confirm,
    _notify: notify,
  };
}

describe('setupGateHook', () => {
  const cfg: GuardrailsGroup[] = [
    {
      group: 'dangerous',
      pattern: '*',
      rules: [
        {
          context: 'command',
          pattern: 'rm -rf *',
          action: 'confirm',
          reason: 'Recursive delete',
        },
        {
          context: 'command',
          pattern: '{mkfs,mkfs.*} *',
          action: 'block',
          reason: 'Format disk',
        },
      ],
    },
    {
      group: 'secrets',
      pattern: '*',
      rules: [
        {
          context: 'file_name',
          pattern: '\\.env$',
          action: 'confirm',
          reason: 'Touching .env',
        },
        {
          context: 'file_name',
          pattern: 'id_rsa',
          action: 'block',
          reason: 'SSH key file',
        },
      ],
    },
  ];

  it('returns undefined when no rule matches', async () => {
    const pi = makePi();
    setupGateHook(pi as never, cfg, () => true);
    const result = await pi.handlers.tool_call(
      { toolName: 'bash', input: { command: 'ls -la' } },
      makeCtx()
    );
    expect(result).toBeUndefined();
  });

  it('returns block on a matching block rule', async () => {
    const pi = makePi();
    setupGateHook(pi as never, cfg, () => true);
    const ctx = makeCtx();
    const result = await pi.handlers.tool_call(
      { toolName: 'bash', input: { command: 'mkfs.ext4 /dev/sda' } },
      ctx
    );
    expect(result).toEqual({ block: true, reason: expect.stringContaining('Format disk') });
    expect(ctx._notify).toHaveBeenCalledWith(expect.stringContaining('dangerous'), 'warning');
  });

  it('prompts confirm and proceeds when user approves', async () => {
    const pi = makePi();
    setupGateHook(pi as never, cfg, () => true);
    const ctx = makeCtx({ confirm: true });
    const result = await pi.handlers.tool_call(
      { toolName: 'bash', input: { command: 'rm -rf /tmp/foo' } },
      ctx
    );
    expect(result).toBeUndefined();
    expect(ctx._confirm).toHaveBeenCalled();
  });

  it('blocks when user denies the confirm prompt', async () => {
    const pi = makePi();
    setupGateHook(pi as never, cfg, () => true);
    const ctx = makeCtx({ confirm: false });
    const result = await pi.handlers.tool_call(
      { toolName: 'bash', input: { command: 'rm -rf /tmp/foo' } },
      ctx
    );
    expect(result).toEqual({ block: true, reason: 'Blocked: User denied' });
  });

  it('blocks confirm rule when no UI is available', async () => {
    const pi = makePi();
    setupGateHook(pi as never, cfg, () => true);
    const ctx = makeCtx({ hasUI: false });
    const result = await pi.handlers.tool_call(
      { toolName: 'bash', input: { command: 'rm -rf /tmp/foo' } },
      ctx
    );
    expect(result).toEqual({ block: true, reason: expect.stringContaining('Recursive delete') });
  });

  it('skips excluded tools (read)', async () => {
    const pi = makePi();
    setupGateHook(pi as never, cfg, () => true);
    const result = await pi.handlers.tool_call(
      { toolName: 'read', input: { path: '/home/u/project/.env' } },
      makeCtx()
    );
    expect(result).toBeUndefined();
  });

  it('no-ops when guardrails are disabled', async () => {
    const pi = makePi();
    setupGateHook(pi as never, cfg, () => false);
    const ctx = makeCtx();
    const result = await pi.handlers.tool_call(
      { toolName: 'bash', input: { command: 'mkfs.ext4 /dev/sda' } },
      ctx
    );
    expect(result).toBeUndefined();
    expect(ctx._confirm).not.toHaveBeenCalled();
  });

  it('file_name confirm rule prompts on .env', async () => {
    const pi = makePi();
    setupGateHook(pi as never, cfg, () => true);
    const ctx = makeCtx({ confirm: true });
    const result = await pi.handlers.tool_call(
      { toolName: 'edit', input: { path: '/home/u/project/.env' } },
      ctx
    );
    expect(result).toBeUndefined();
    expect(ctx._confirm).toHaveBeenCalledWith(
      expect.stringContaining('secrets'),
      '/home/u/project/.env'
    );
  });

  it('file_name block rule returns block on id_rsa', async () => {
    const pi = makePi();
    setupGateHook(pi as never, cfg, () => true);
    const ctx = makeCtx();
    const result = await pi.handlers.tool_call(
      { toolName: 'edit', input: { path: '/home/u/.ssh/id_rsa' } },
      ctx
    );
    expect(result).toEqual({ block: true, reason: expect.stringContaining('SSH key') });
  });
});

describe('isPathWithinProject (via scope="project" rules)', () => {
  const cfg: GuardrailsGroup[] = [
    {
      group: 'project-only',
      pattern: '*',
      rules: [
        {
          context: 'file_name',
          pattern: 'secrets\\.txt$',
          scope: 'project',
          action: 'confirm',
          reason: 'Project secret file',
        },
      ],
    },
  ];

  it('matches file inside cwd', async () => {
    const pi = makePi();
    setupGateHook(pi as never, cfg, () => true);
    const ctx = makeCtx({ confirm: true, cwd: '/home/u/project' });
    const result = await pi.handlers.tool_call(
      { toolName: 'edit', input: { path: '/home/u/project/sub/secrets.txt' } },
      ctx
    );
    expect(result).toBeUndefined();
    expect(ctx._confirm).toHaveBeenCalledWith(
      expect.stringContaining('project-only'),
      '/home/u/project/sub/secrets.txt'
    );
  });

  it('does not match file outside cwd', async () => {
    const pi = makePi();
    setupGateHook(pi as never, cfg, () => true);
    const result = await pi.handlers.tool_call(
      { toolName: 'edit', input: { path: '/etc/secrets.txt' } },
      makeCtx({ cwd: '/home/u/project' })
    );
    expect(result).toBeUndefined();
  });

  it('handles cwd with trailing slash', async () => {
    const pi = makePi();
    setupGateHook(pi as never, cfg, () => true);
    const ctx = makeCtx({ confirm: true, cwd: '/home/u/project/' });
    const result = await pi.handlers.tool_call(
      { toolName: 'edit', input: { path: '/home/u/project/secrets.txt' } },
      ctx
    );
    expect(result).toBeUndefined();
    expect(ctx._confirm).toHaveBeenCalled();
  });
});
