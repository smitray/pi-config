import type { AgentToolResult, ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

interface NotifyToolParams {
  message: string;
}

function buildErrorResult(
  errorMessage: string,
  result: { code: number; stdout: string; stderr: string }
): AgentToolResult<{
  exitCode: number;
  output: string;
}> {
  return {
    content: [
      {
        type: 'text' as const,
        text: `Failed to send notification: ${errorMessage}`,
      },
    ],
    details: {
      exitCode: result.code,
      output: result.stdout || result.stderr,
    },
  };
}

async function sendNotifySend(
  pi: ExtensionAPI,
  message: string,
  signal: AbortSignal | undefined
): Promise<AgentToolResult<Record<string, unknown>>> {
  const result = await pi.exec('notify-send', [message], {
    signal: signal ?? undefined,
  });

  if (result.code !== 0) {
    return buildErrorResult(
      result.stderr || 'notify-send failed. Is notify-send installed and available in PATH?',
      result
    );
  }

  return {
    content: [{ type: 'text' as const, text: 'Notification sent successfully' }],
    details: {
      exitCode: result.code,
      stdout: result.stdout,
      stderr: result.stderr,
    } as Record<string, unknown>,
  };
}

export default function notifyExtension(pi: ExtensionAPI): void {
  pi.on('agent_settled', () => {
    void pi.exec('notify-send', ['pi: task completed']);
  });

  pi.registerTool({
    name: 'notify',
    label: 'Inform User',
    description:
      'Inform the user what is happening. Notify on phase changes, mutations, and task completion. Keep messages high-level.',
    parameters: Type.Object({
      message: Type.String({
        description: 'The notification message',
      }),
    }),
    execute: async (
      _toolCallId: string,
      params: NotifyToolParams,
      signal: AbortSignal | undefined
    ): Promise<AgentToolResult<Record<string, unknown>>> => {
      return sendNotifySend(pi, params.message, signal);
    },
  });
}
