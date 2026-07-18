/**
 * Shared guardrails rules registry.
 *
 * Extensions register rules at load time via registerRules().
 * The guardrails gate hook reads them on every tool_call event.
 *
 * Moved here from guardrails/api.ts to decouple kb ↔ guardrails.
 */

export interface GuardrailsRule {
  context: 'command' | 'file_name' | 'file_content';
  pattern: string;
  file_pattern?: string;
  includes?: string;
  excludes?: string;
  scope?: 'project' | 'external';
  action: 'block' | 'confirm';
  reason: string;
}

export interface GuardrailsGroup {
  group: string;
  pattern: string;
  rules: GuardrailsRule[];
}

const dynamicGroups: GuardrailsGroup[] = [];

export function registerRules(group: GuardrailsGroup): void {
  dynamicGroups.push(group);
}

export function getDynamicGroups(): GuardrailsGroup[] {
  return dynamicGroups;
}
