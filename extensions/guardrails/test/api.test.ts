import { beforeEach, describe, expect, it } from 'vitest';
import { getDynamicGroups, registerRules } from '../api';
import type { GuardrailsGroup } from '../types';

// Reset dynamic groups between tests
beforeEach(() => {
  // Clear the array by splicing
  const groups = getDynamicGroups();
  groups.splice(0, groups.length);
});

describe('guardrails registration API', () => {
  it('starts with empty dynamic groups', () => {
    expect(getDynamicGroups()).toEqual([]);
  });

  it('registers a single group', () => {
    const group: GuardrailsGroup = {
      group: 'test-group',
      pattern: '*',
      rules: [
        {
          context: 'file_name',
          pattern: 'test\\.txt$',
          action: 'block',
          reason: 'Test file blocked',
        },
      ],
    };

    registerRules(group);
    expect(getDynamicGroups()).toHaveLength(1);
    expect(getDynamicGroups()[0]).toEqual(group);
  });

  it('registers multiple groups', () => {
    const group1: GuardrailsGroup = {
      group: 'group-1',
      pattern: '*',
      rules: [
        {
          context: 'file_name',
          pattern: 'file1\\.txt$',
          action: 'block',
          reason: 'File 1 blocked',
        },
      ],
    };

    const group2: GuardrailsGroup = {
      group: 'group-2',
      pattern: '*',
      rules: [
        {
          context: 'file_name',
          pattern: 'file2\\.txt$',
          action: 'confirm',
          reason: 'File 2 confirm',
        },
      ],
    };

    registerRules(group1);
    registerRules(group2);

    expect(getDynamicGroups()).toHaveLength(2);
    expect(getDynamicGroups()[0].group).toBe('group-1');
    expect(getDynamicGroups()[1].group).toBe('group-2');
  });

  it('returns the same array reference (module-level state)', () => {
    const ref1 = getDynamicGroups();
    const ref2 = getDynamicGroups();
    expect(ref1).toBe(ref2);
  });
});
