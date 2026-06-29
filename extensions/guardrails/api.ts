import type { GuardrailsGroup } from './types';

// ─── Dynamic rules registry ──────────────────────────
// ponytail: module-level array. Extensions import registerRules() and call it
// at load time. The gate hook reads this array on every tool_call event, so
// rules registered after hook setup are still picked up.

const dynamicGroups: GuardrailsGroup[] = [];

/**
 * Register a guardrails group dynamically.
 * Call this at extension load time (before any tool_call fires).
 *
 * @example
 * ```ts
 * import { registerRules } from '../guardrails/api';
 *
 * registerRules({
 *   group: 'kb-immutable',
 *   pattern: '*',
 *   rules: [
 *     { context: 'file_name', pattern: '\\.kb/raw', action: 'block', reason: 'raw/ is immutable' },
 *   ],
 * });
 * ```
 */
export function registerRules(group: GuardrailsGroup): void {
  dynamicGroups.push(group);
}

/**
 * Get all dynamically registered groups.
 * Used by the gate hook to merge with built-in defaults.
 */
export function getDynamicGroups(): GuardrailsGroup[] {
  return dynamicGroups;
}
