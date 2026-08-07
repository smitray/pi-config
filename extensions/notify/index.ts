import { execSync } from 'node:child_process';
import type { AgentToolResult, ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

const COOLDOWN_MS = 5_000; // skip notify if user typed within last 5s

let lastInputTime = 0;

function isTerminalFocused(): boolean {
  try {
    const json = execSync('hyprctl activewindow -j 2>/dev/null', {
      encoding: 'utf8',
      timeout: 500,
    });
    const active = JSON.parse(json);
    // match by pid — our parent terminal
    if (active.pid === process.ppid) return true;
    // fallback: title contains pi
    if (typeof active.title === 'string' && active.title.includes('π')) return true;
    return false;
  } catch {
    return false;
  }
}

function shouldNotify(): boolean {
  if (Date.now() - lastInputTime < COOLDOWN_MS) return false;
  if (isTerminalFocused()) return false;
  return true;
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
  category: string | undefined,
  signal: AbortSignal | undefined
): Promise<AgentToolResult<Record<string, unknown>>> {
  const args = category ? ['--category', category, message] : [message];
  const result = await pi.exec('notify-send', args, {
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
  // track user activity
  pi.on('input', async (_event, _ctx) => {
    lastInputTime = Date.now();
  });

  // notify on settle only if user isn't watching
  pi.on('agent_settled', () => {
    if (shouldNotify()) {
      void pi.exec('notify-send', ['--category', 'pi.task', 'pi: task completed']);
    }
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
      category: Type.Optional(
        Type.String({
          description: 'Notification category: pi.task (default), pi.error, pi.info, pi.milestone',
        })
      ),
    }),
    execute: async (
      _toolCallId: string,
      params: { message: string; category?: string },
      signal: AbortSignal | undefined
    ): Promise<AgentToolResult<Record<string, unknown>>> => {
      return sendNotifySend(pi, params.message, params.category, signal);
    },
  });
}
