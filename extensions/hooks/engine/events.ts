import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { HooksConfig } from '../types/schema';
import { runHooks } from './hook-execution';

function notifyMessages(ctx: ExtensionContext, messages: string[] | undefined): void {
  if (!ctx.hasUI || !messages || messages.length === 0) return;
  // Cap at 5 to avoid flooding the UI on busy sessions.
  for (const msg of messages.slice(0, 5)) {
    ctx.ui.notify(msg, 'info');
  }
}

async function runSessionEvent(
  ctx: ExtensionContext,
  event: 'session_start' | 'session_shutdown' | 'agent_start',
  isEnabled: () => boolean,
  getConfig: () => Promise<HooksConfig>
): Promise<void> {
  if (!isEnabled()) return;
  try {
    const config = await getConfig();
    const result = await runHooks(config, event, { cwd: ctx.cwd });
    notifyMessages(ctx, result.messages);
  } catch (err) {
    ctx.ui.notify(`Hook error (${event}): ${err}`, 'warning');
  }
}

export function registerEventHandlers(
  pi: ExtensionAPI,
  getConfig: () => Promise<HooksConfig>,
  isEnabled: () => boolean
): void {
  // Session lifecycle — informational only (no blocking, no input).
  pi.on('session_start', async (_event, ctx) => {
    await runSessionEvent(ctx, 'session_start', isEnabled, getConfig);
  });

  pi.on('session_shutdown', async (_event, ctx) => {
    await runSessionEvent(ctx, 'session_shutdown', isEnabled, getConfig);
  });

  pi.on('agent_start', async (_event, ctx) => {
    await runSessionEvent(ctx, 'agent_start', isEnabled, getConfig);
  });

  // tool_call — hooks can block execution.
  pi.on('tool_call', async (event, ctx) => {
    if (!isEnabled()) return undefined;
    try {
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
      notifyMessages(ctx, result.messages);
      if (result.block) {
        ctx.ui.notify(`Hook blocked ${event.toolName}: ${result.reason}`, 'warning');
        return { block: true, reason: result.reason };
      }
    } catch (err) {
      ctx.ui.notify(`Hook error (tool_call): ${err}`, 'warning');
    }
    return undefined;
  });

  // tool_result — post-execution hooks. Cannot block.
  pi.on('tool_result', async (event, ctx) => {
    if (!isEnabled()) return;
    try {
      const config = await getConfig();
      const result = await runHooks(
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
      notifyMessages(ctx, result.messages);
    } catch (err) {
      ctx.ui.notify(`Hook error (tool_result): ${err}`, 'warning');
    }
  });
}
