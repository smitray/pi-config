/**
 * Re-export guardrails registry from _shared.
 *
 * The dynamic rules registry lives in ./guardrails-registry.ts
 * so both kb and guardrails can import from a neutral location.
 */

export type { GuardrailsGroup, GuardrailsRule } from './guardrails-registry';
export { getDynamicGroups, registerRules } from './guardrails-registry';
