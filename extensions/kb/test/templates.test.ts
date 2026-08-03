import { describe, expect, it } from 'vitest';
import { buildPage } from '../lib/templates';
import type { VaultPaths } from '../lib/vault';

const fakePaths: VaultPaths = {
  root: '/tmp',
  raw: '/tmp',
  rawSources: '/tmp',
  wiki: '/tmp',
  meta: '/tmp',
  dotKb: '/tmp',
  templates: '/home/debasmitr/.pi/agent/extensions/kb/templates/pages',
};

describe('new page templates', () => {
  for (const type of [
    'research',
    'library-doc',
    'daily-log',
    'brainstorm',
    'sprint-plan',
    'spec',
    'task',
  ] as const) {
    it(`${type} loads real template (not stub)`, () => {
      const r = buildPage(type, 'Test', fakePaths, { id: 'TEST-001', tags: [] });
      const expected: Record<typeof type, string> = {
        research: 'Question',
        'library-doc': 'Summary',
        'daily-log': 'Day Intent',
        brainstorm: 'Raw Ideas',
        'sprint-plan': 'Sprint Goal',
        spec: 'Problem Statement',
        task: 'Objective',
      };
      expect(r.content).toContain(expected[type]);
      expect(r.content).toContain('TEST-001');
      const prefixMap: Record<typeof type, string> = {
        research: 'res',
        'library-doc': 'lib',
        'daily-log': 'day',
        brainstorm: 'br',
        'sprint-plan': 'sp',
        spec: 'spec',
        task: 'task',
      };
      expect(r.filename).toMatch(new RegExp(`^${prefixMap[type]}-TEST-001\\.md$`));
    });
  }
});
