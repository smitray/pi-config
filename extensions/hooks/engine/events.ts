import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { HooksConfig } from '../types/schema';
import { runHooks } from './hook-execution';

export function registerEventHandlers(
  pi: ExtensionAPI,
  getConfig: () => Promise<HooksConfig>,
  isEnabled: () => boolean
): void {
  // Session events
  for (const event of ['session_start', 'session_shutdown', 'agent_start'] as const) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pi.on as any)(event, async (_event: unknown, ctx: any) => {
      try {
        if (!isEnabled()) return;
        const config = await getConfig();
        await runHooks(config, event, { cwd: ctx.cwd });
      } catch {
        // stale context
      }
    });
  }

  // Tool call (can block)
  pi.on('tool_call', async (event, ctx) => {
    try {
      if (!isEnabled()) return;
      const config = await getConfig();
      const result = await runHooks(
        config,
        'tool_call',
        { cwd: ctx.cwd },
        {
          toolName: event.toolName,
          input: event.input as Record<string, unknown>,
        }
      );
      if (result.block) {
        return { block: true, reason: result.reason };
      }
    } catch {
      // stale context
    }
    return undefined;
  });

  // Tool result
  pi.on('tool_result', async (event, ctx) => {
    try {
      if (!isEnabled()) return;
      const config = await getConfig();
      await runHooks(
        config,
        'tool_result',
        { cwd: ctx.cwd },
        {
          toolName: event.toolName,
          input: event.input as Record<string, unknown>,
          toolCallId: event.toolCallId,
          toolResponse: {
            content: event.content as unknown[] | undefined,
            details: event.details as Record<string, unknown> | undefined,
            isError: event.isError,
          },
        }
      );
    } catch {
      // stale context
    }
  });
}
