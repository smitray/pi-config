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
    'schedule',
    'library',
    'research',
    'plan',
    'content',
    'ticket',
    'todo',
  ] as const) {
    it(`${type} loads real template (not stub)`, () => {
      const r = buildPage(type, 'Test', fakePaths, { id: 'TEST-001', tags: [] });
      const expected: Record<typeof type, string> = {
        schedule: 'Morning (',
        library: 'URL:',
        research: 'Question',
        plan: 'Goal',
        content: 'Idea',
        ticket: 'Acceptance Criteria',
        todo: 'Parent',
      };
      expect(r.content).toContain(expected[type]);
      expect(r.content).toContain('TEST-001');
      const prefixMap: Record<typeof type, string> = {
        schedule: 'sched',
        library: 'lib',
        research: 'res',
        plan: 'plan',
        content: 'cont',
        ticket: 'tick',
        todo: 'todo',
      };
      expect(r.filename).toMatch(new RegExp(`^${prefixMap[type]}-TEST-001\\.md$`));
    });
  }
});
