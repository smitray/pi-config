/**
 * Re-export guardrails types from _shared.
 */
export type { GuardrailsGroup, GuardrailsRule } from './guardrails-registry';

import type { GuardrailsGroup, GuardrailsRule } from './guardrails-registry';

export interface MatchedRule {
  rule: GuardrailsRule;
  group: GuardrailsGroup;
  targetValue: string;
}
