import { execSync } from 'node:child_process';
import type { HookInput, HookOutput, HookRule, HooksConfig } from '../types/schema';

const VARIABLE_PATTERN = /%(file|tool|cwd)%/g;

function substituteVariables(command: string, input: HookInput): string {
  return command.replace(VARIABLE_PATTERN, (_match, varName: string) => {
    switch (varName) {
      case 'file':
        return getFileFromInput(input) ?? '';
      case 'tool':
        return input.tool_name ?? '';
      case 'cwd':
        return input.cwd;
      default:
        return '';
    }
  });
}

function getFileFromInput(input: HookInput): string | undefined {
  const toolInput = input.tool_input;
  if (!toolInput) return undefined;
  return (toolInput.path as string) ?? (toolInput.command as string);
}

function matchesPattern(context: string | undefined, value: string, pattern: string): boolean {
  if (!context || !pattern) return true;
  try {
    const regex = new RegExp(pattern, 'i');
    return regex.test(value);
  } catch {
    return value.toLowerCase().includes(pattern.toLowerCase());
  }
}

function getTargetValue(rule: HookRule, input: HookInput): string | undefined {
  if (!rule.context) return undefined;
  switch (rule.context) {
    case 'tool_name':
      return input.tool_name;
    case 'file_name':
      return getFileFromInput(input);
    case 'command':
      return input.tool_input?.command as string | undefined;
    default:
      return undefined;
  }
}

function shouldRunHook(rule: HookRule, input: HookInput): boolean {
  const target = getTargetValue(rule, input);
  if (!target) return rule.context === undefined;
  return matchesPattern(rule.context, target, rule.pattern ?? '');
}

function runHookCommand(
  command: string,
  cwd: string,
  timeout: number,
  input: HookInput
): HookOutput {
  const resolved = substituteVariables(command, input);
  try {
    const stdout = execSync(resolved, {
      cwd,
      encoding: 'utf-8',
      timeout,
      maxBuffer: 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    try {
      return JSON.parse(stdout) as HookOutput;
    } catch {
      return {};
    }
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    if (e.status === 2) {
      return { decision: 'block', reason: e.stderr || e.stdout || 'Hook blocked execution' };
    }
    return {};
  }
}

export interface RunHooksResult {
  block?: true;
  reason?: string;
  messages?: string[];
}

export async function runHooks(
  config: HooksConfig,
  event: string,
  ctx: { cwd: string },
  toolInfo?: {
    toolName?: string;
    input?: Record<string, unknown>;
    toolCallId?: string;
    toolResponse?: { content?: unknown[]; details?: unknown; isError?: boolean };
  }
): Promise<RunHooksResult> {
  const input: HookInput = {
    cwd: ctx.cwd,
    hook_event_name: event as HookRule['event'],
    tool_name: toolInfo?.toolName,
    tool_input: toolInfo?.input as Record<string, unknown> | undefined,
    tool_call_id: toolInfo?.toolCallId,
    tool_response: toolInfo?.toolResponse as HookInput['tool_response'],
  };

  const messages: string[] = [];

  for (const group of config) {
    for (const hook of group.hooks) {
      if (hook.event !== event) continue;
      if (!shouldRunHook(hook, input)) continue;

      const timeout = hook.timeout ?? 10_000;
      const result = runHookCommand(hook.command, hook.cwd ?? ctx.cwd, timeout, input);

      if (result.decision === 'block') {
        return { block: true, reason: result.reason ?? `Hook blocked: ${group.group}` };
      }

      if (result.systemMessage && hook.notify) {
        messages.push(result.systemMessage);
      }
    }
  }

  return { messages };
}
