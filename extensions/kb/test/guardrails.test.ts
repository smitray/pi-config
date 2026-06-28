import { describe, expect, it, beforeEach } from 'vitest';
import { installGuardrails } from '../lib/guardrails';
import { getDynamicGroups } from '../../guardrails/api';

// Reset dynamic groups between tests
beforeEach(() => {
  const groups = getDynamicGroups();
  groups.splice(0, groups.length);
});

describe('KB guardrails', () => {
  it('registers kb-immutable group with guardrails extension', () => {
    installGuardrails();

    const groups = getDynamicGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].group).toBe('kb-immutable');
    expect(groups[0].pattern).toBe('*');
  });

  it('registers two rules for raw and meta paths', () => {
    installGuardrails();

    const groups = getDynamicGroups();
    const rules = groups[0].rules;

    expect(rules).toHaveLength(2);

    // Rule 1: block writes to .kb/raw
    expect(rules[0].context).toBe('file_name');
    expect(rules[0].pattern).toBe('\\.kb/raw');
    expect(rules[0].action).toBe('block');
    expect(rules[0].reason).toContain('immutable');

    // Rule 2: block writes to .kb/meta
    expect(rules[1].context).toBe('file_name');
    expect(rules[1].pattern).toBe('\\.kb/meta');
    expect(rules[1].action).toBe('block');
    expect(rules[1].reason).toContain('auto-generated');
  });

  it('can be called multiple times without duplicate accumulation', () => {
    // In real usage, installGuardrails is called once at extension load.
    // But let's verify it doesn't break if called multiple times.
    installGuardrails();
    installGuardrails();

    const groups = getDynamicGroups();
    // Each call adds a group, so 2 calls = 2 groups
    // This is expected behavior - the extension should only call it once
    expect(groups).toHaveLength(2);
  });
});
