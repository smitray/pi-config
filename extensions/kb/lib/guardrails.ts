import { registerRules } from '../../_shared/guardrails-registry';

// ponytail: KB guardrails register with the guardrails extension instead of
// using an inline tool_call hook. The guardrails extension handles the hook,
// pattern matching, and user confirmation. We just declare the rules.

/**
 * Register KB-specific guardrails with the guardrails extension.
 *
 * Rules:
 * - Block writes to .kb/raw/ (immutable source packets)
 * - Block writes to .kb/meta/ (auto-generated metadata)
 *
 * Vault path is resolved per-event from cwd, not at load time.
 * This handles the case where cwd changes between sessions/projects.
 */
export function installGuardrails(): void {
  // ponytail: we register a single group with a wildcard pattern.
  // The actual path matching happens in the rule's context + pattern.
  // We use file_name context with a regex that matches .kb/raw or .kb/meta.
  registerRules({
    group: 'kb-immutable',
    pattern: '*',
    rules: [
      {
        context: 'file_name',
        pattern: '\\.kb/raw',
        action: 'block',
        reason: '.kb/raw/ is immutable — source packets cannot be edited after capture',
      },
      {
        context: 'file_name',
        pattern: '\\.kb/meta',
        action: 'block',
        reason: '.kb/meta/ is auto-generated — edit pages in wiki/ instead',
      },
    ],
  });
}
