/**
 * Re-export guardrails types from _shared.
 */
export type { GuardrailsGroup, GuardrailsRule } from '../_shared/guardrails-registry';

import type { GuardrailsGroup, GuardrailsRule } from '../_shared/guardrails-registry';

export interface MatchedRule {
  rule: GuardrailsRule;
  group: GuardrailsGroup;
  targetValue: string;
}
