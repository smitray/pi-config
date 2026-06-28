import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { getDynamicGroups } from './api';
import { matchCommandPattern, matchContentPattern, matchFileNamePattern } from './matcher';
import type { GuardrailsGroup, GuardrailsRule, MatchedRule } from './types';

// ─── Helpers ─────────────────────────────────────────

function getInputField(input: unknown, field: string): string | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const val = (input as Record<string, unknown>)[field];
  if (val === undefined || val === null) return undefined;
  return typeof val === 'string' ? val : String(val);
}

function isPathWithinProject(filePath: string, cwd: string): boolean {
  const abs = filePath.startsWith('/') ? filePath : `${cwd}/${filePath}`;
  const norm = abs.replace(/\/+/g, '/');
  const root = cwd.replace(/\/+$/, '').replace(/\/+/g, '/');
  if (!root) return false;
  return norm.startsWith(`${root}/`);
}

// ─── Pattern matching ────────────────────────────────

function matchesPattern(
  context: GuardrailsRule['context'],
  target: string,
  pattern: string
): boolean {
  switch (context) {
    case 'command':
      return matchCommandPattern(target, pattern);
    case 'file_name':
      return matchFileNamePattern(target, pattern);
    case 'file_content':
      return matchContentPattern(target, pattern);
    default:
      return false;
  }
}

function checkFilePattern(filePath: string | undefined, filePattern: string | undefined): boolean {
  if (!filePattern || !filePath) return true;
  return matchFileNamePattern(filePath, filePattern);
}

function passesScope(rule: GuardrailsRule, filePath: string | undefined, cwd: string): boolean {
  if (!rule.scope) return true;
  if (!filePath) return true;
  const within = isPathWithinProject(filePath, cwd);
  return rule.scope === 'project' ? within : !within;
}

// ─── Rule matching ───────────────────────────────────

function matchRule(
  rule: GuardrailsRule,
  toolName: string,
  input: unknown,
  cwd: string
): { targetValue: string } | null {
  if (rule.context === 'command') {
    if (toolName !== 'bash') return null;
    const cmd = getInputField(input, 'command');
    if (!cmd) return null;
    if (!matchesPattern('command', cmd, rule.pattern)) return null;
    return { targetValue: cmd };
  }

  // file_name or file_content
  const filePath = getInputField(input, 'path');
  if (!filePath) return null;
  if (!checkFilePattern(filePath, rule.file_pattern)) return null;
  if (!passesScope(rule, filePath, cwd)) return null;

  if (rule.context === 'file_name') {
    if (!matchesPattern('file_name', filePath, rule.pattern)) return null;
    return { targetValue: filePath };
  }

  // file_content
  let content: string | undefined;
  if (toolName === 'edit') content = getInputField(input, 'newText');
  else if (toolName === 'write') content = getInputField(input, 'content');
  if (!content) return null;
  if (!matchesPattern('file_content', content, rule.pattern)) return null;
  return { targetValue: content.slice(0, 200) };
}

function passesIncludes(rule: GuardrailsRule, target: string): boolean {
  if (!rule.includes) return true;
  return matchesPattern(rule.context, target, rule.includes);
}

function passesExcludes(rule: GuardrailsRule, target: string): boolean {
  if (!rule.excludes) return true;
  return !matchesPattern(rule.context, target, rule.excludes);
}

function findMatches(
  groups: GuardrailsGroup[],
  toolName: string,
  input: unknown,
  cwd: string
): MatchedRule[] {
  const matched: MatchedRule[] = [];

  for (const group of groups) {
    for (const rule of group.rules) {
      const result = matchRule(rule, toolName, input, cwd);
      if (!result) continue;
      if (!passesIncludes(rule, result.targetValue)) continue;
      if (!passesExcludes(rule, result.targetValue)) continue;
      matched.push({ rule, group, targetValue: result.targetValue });
    }
  }

  return matched;
}

// ─── Gate hook ────────────────────────────────────────

const EXCLUDED_TOOLS = new Set(['read', 'genui']);

export function setupGateHook(
  pi: ExtensionAPI,
  config: GuardrailsGroup[],
  isEnabled: () => boolean
) {
  pi.on('tool_call', async (event, ctx) => {
    if (!isEnabled()) return;
    if (EXCLUDED_TOOLS.has(event.toolName)) return;

    // Merge static config with dynamically registered rules
    const allGroups = [...config, ...getDynamicGroups()];
    const matches = findMatches(allGroups, event.toolName, event.input, ctx.cwd);

    for (const matched of matches) {
      const { rule, group, targetValue } = matched;

      if (rule.action === 'block') {
        const reason = `Blocked [${group.group}]: ${rule.reason}`;
        if (ctx.hasUI) {
          ctx.ui.notify(`Guardrails: ${group.group}`, 'warning');
        }
        return { block: true, reason };
      }

      if (rule.action === 'confirm') {
        if (!ctx.hasUI) {
          return { block: true, reason: `Blocked [${group.group}]: ${rule.reason}` };
        }
        const ok = await ctx.ui.confirm(`${group.group}: ${rule.reason}`, targetValue);
        if (!ok) return { block: true, reason: 'Blocked: User denied' };
      }
    }

    return undefined;
  });
}
