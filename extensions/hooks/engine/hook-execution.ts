import { runCommand } from '../../_shared/spawn';
import type { HookInput, HookOutput, HookRule, HooksConfig } from '../types/schema';

// ponytail: three named vars now (%file%, %command%, %tool%, %cwd%) — keep regex
// in sync with the substitution map. Add new vars here.
const VARIABLE_PATTERN = /%(file|command|tool|cwd)%/g;

function substituteVariables(command: string, input: HookInput): string {
  return command.replace(VARIABLE_PATTERN, (_match, varName: string) => {
    switch (varName) {
      case 'file':
        return getFileFromInput(input) ?? '';
      case 'command':
        return getCommandFromInput(input) ?? '';
      case 'tool':
        return input.tool_name ?? '';
      case 'cwd':
        return input.cwd;
      default:
        return '';
    }
  });
}

/**
 * `%file%` returns the file path the tool is acting on. Only returns a value
 * when the tool has a path concept (edit/write/read/find/grep/etc.). For
 * `bash` invocations, returns `undefined` — use `%command%` for those.
 */
function getFileFromInput(input: HookInput): string | undefined {
  const toolInput = input.tool_input;
  if (!toolInput) return undefined;
  const path = toolInput.path;
  return typeof path === 'string' ? path : undefined;
}

/**
 * `%command%` returns the bash command being run. Only populated when
 * `tool_name === 'bash'` (or any tool with a `command` field).
 */
function getCommandFromInput(input: HookInput): string | undefined {
  const toolInput = input.tool_input;
  if (!toolInput) return undefined;
  const cmd = toolInput.command;
  return typeof cmd === 'string' ? cmd : undefined;
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
      return getCommandFromInput(input);
    default:
      return undefined;
  }
}

function shouldRunHook(rule: HookRule, input: HookInput): boolean {
  const target = getTargetValue(rule, input);
  if (!target) return rule.context === undefined;
  return matchesPattern(rule.context, target, rule.pattern ?? '');
}

async function runHookCommand(
  command: string,
  cwd: string,
  timeoutMs: number,
  input: HookInput
): Promise<HookOutput> {
  const resolved = substituteVariables(command, input);
  const r = await runCommand('sh', ['-c', resolved], {
    cwd,
    env: { PI_HOOK: '1' },
    timeoutMs,
  });

  // Exit code 2 = block (Claude Code hook convention). Check this BEFORE the
  // generic !r.ok gate, because exit 2 also makes ok=false under our shared
  // spawn helper.
  if (r.exitCode === 2) {
    return { decision: 'block', reason: r.stderr || r.stdout || 'Hook blocked execution' };
  }

  // Spawn itself failed (ENOENT, signal-killed, etc.) or non-2 non-zero exit:
  // treat as failure but don't block the tool call.
  if (!r.ok || r.exitCode !== 0) {
    return {};
  }

  // Exit 0: try to parse stdout as HookOutput JSON. If not JSON, ignore.
  const trimmed = r.stdout.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed) as HookOutput;
  } catch {
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
      let result: HookOutput;
      try {
        result = await runHookCommand(hook.command, hook.cwd ?? ctx.cwd, timeout, input);
      } catch {
        // last-ditch guard — runCommand should never throw
        continue;
      }

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
