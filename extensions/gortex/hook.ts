import { execFileSync } from 'node:child_process';
import { HOOK_ARGV } from './config';
import type { PiApi, PiDecision } from './types';

// Pi vocabulary -> canonical Claude-Code vocabulary. The Go enrich() classifier
// switches on Claude-Code tool names ("Read"/"Grep"/"Glob"/"Bash"/"Edit"/
// "Write") and reads canonical input keys. Pi uses its own lowercase names and
// input shapes, so we translate here — keeping all Pi-specific knowledge in
// this Pi-specific extension.
const TOOL_NAME_MAP: Record<string, string> = {
  read: 'Read',
  grep: 'Grep',
  rg: 'Grep',
  find: 'Glob',
  ls: 'Glob',
  bash: 'Bash',
  edit: 'Edit',
  write: 'Write',
};

function firstString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v !== '') return v;
  }
  return undefined;
}

export function normalizeToolCall(
  piName: string,
  piInput: Record<string, unknown>
): { tool_name: string; tool_input: Record<string, unknown> } {
  const canonical = TOOL_NAME_MAP[piName.toLowerCase()] ?? piName;
  const out: Record<string, unknown> = { ...piInput };

  const path = firstString(piInput, ['file_path', 'path', 'file', 'filepath', 'absolute_path']);
  if (path !== undefined) out.file_path = path;

  let pattern = firstString(piInput, ['pattern', 'glob', 'query', 'regex', 'name']);
  if (pattern === undefined && canonical === 'Glob') pattern = path;
  if (pattern !== undefined) out.pattern = pattern;

  const command = firstString(piInput, ['command', 'cmd', 'script']);
  if (command !== undefined) out.command = command;

  return { tool_name: canonical, tool_input: out };
}

// Send a normalized event envelope to `gortex hook --agent=pi` and parse the
// PiDecision it writes back. Fail-open: any error returns an empty decision so
// the extension never blocks Pi's flow on a hook hiccup (daemon down, parse
// error, timeout).
export function callHook(envelope: Record<string, unknown>): PiDecision {
  try {
    const out = execFileSync(HOOK_ARGV[0], HOOK_ARGV.slice(1), {
      input: JSON.stringify(envelope),
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      timeout: 5_000,
    }).trim();
    if (!out) return {};
    return JSON.parse(out) as PiDecision;
  } catch {
    return {};
  }
}

// Evaluate a native tool_call against the Go hook and apply its decision:
// block the call, or surface soft guidance without blocking. Kept here (not in
// index.ts) so the extension entry point stays purely lifecycle wiring.
// `isGortexTool` tells the Go side whether the call is already a graph tool,
// which it never blocks.
export function evaluateToolCall(pi: PiApi, event: any, ctx: any, isGortexTool: boolean): unknown {
  const piName: string = event?.toolName ?? '';
  const piInput: Record<string, unknown> = event?.input ?? {};

  const norm = normalizeToolCall(piName, piInput);
  const decision = callHook({
    event: 'tool_call',
    tool_name: norm.tool_name,
    tool_input: norm.tool_input,
    cwd: ctx?.cwd ?? pi?.cwd ?? process.cwd(),
    session_id: ctx?.sessionManager?.sessionId ?? '',
    is_gortex_tool: isGortexTool,
  });

  if (decision.block) {
    // Replace Go binary's Claude-Code syntax with Pi-native tool names.
    const reason =
      '[Gortex] Blocked native tool on indexed source. Use gortex_* tools instead:\n' +
      '- gortex_explore(task="<what to do>") — find files/symbols first\n' +
      '- gortex_search(operation="text", query="<text>") — search text\n' +
      '- gortex_search(operation="symbols", query="<name>") — search symbols\n' +
      '- gortex_read(operation="file", target={file:"<path>"}) — read file';
    return { block: true, reason };
  }
  if (decision.additional_context) {
    // Soft guidance: surface it without blocking the call.
    try {
      pi.sendMessage?.(
        { customType: 'gortex', content: decision.additional_context, display: true },
        { deliverAs: 'steer' }
      );
    } catch {
      // sendMessage shape can vary across Pi versions; never fatal.
    }
  }
  return undefined;
}
