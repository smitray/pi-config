import { describe, expect, it, vi } from 'vitest';
import {
  registerBrainstormTool,
  registerKanbanTool,
  registerProjectPageTool,
  registerProjectTools,
  registerResearchTool,
  registerSpecTool,
  registerSprintPlanTool,
  registerTaskTool,
} from '../lib/create-tools';

function makePi() {
  const tools: Array<{ name: string; label: string; parameters: unknown }> = [];
  return {
    tools,
    registerTool(def: { name: string; label: string; parameters: unknown }) {
      tools.push(def);
    },
    on: vi.fn(),
    registerCommand: vi.fn(),
  };
}

const TOOLS = [
  {
    name: 'registerResearchTool',
    fn: registerResearchTool,
    toolName: 'kb_create_research',
    param: 'title',
  },
  {
    name: 'registerProjectPageTool',
    fn: registerProjectPageTool,
    toolName: 'kb_create_project_page',
    param: 'title',
  },
  {
    name: 'registerBrainstormTool',
    fn: registerBrainstormTool,
    toolName: 'kb_create_brainstorm',
    param: 'title',
  },
  {
    name: 'registerSprintPlanTool',
    fn: registerSprintPlanTool,
    toolName: 'kb_create_sprint_plan',
    param: 'title',
  },
  { name: 'registerSpecTool', fn: registerSpecTool, toolName: 'kb_create_spec', param: 'title' },
  { name: 'registerTaskTool', fn: registerTaskTool, toolName: 'kb_create_task', param: 'title' },
  { name: 'registerKanbanTool', fn: registerKanbanTool, toolName: 'kb_kanban', param: 'project' },
];

for (const { name, fn, toolName, param } of TOOLS) {
  describe(name, () => {
    it(`registers ${toolName} tool`, () => {
      const pi = makePi() as Parameters<typeof fn>[0];
      fn(pi);
      expect(pi.tools).toHaveLength(1);
      expect(pi.tools[0].name).toBe(toolName);
    });

    it(`has required ${param} parameter`, () => {
      const pi = makePi() as Parameters<typeof fn>[0];
      fn(pi);
      const props = (pi.tools[0].parameters as { properties: Record<string, unknown> }).properties;
      expect(props).toHaveProperty(param);
    });
  });
}

describe('registerProjectTools', () => {
  it('registers kb_create_project and kb_list_projects', () => {
    const pi = makePi() as Parameters<typeof registerProjectTools>[0];
    registerProjectTools(pi);
    expect(pi.tools).toHaveLength(2);
    expect(pi.tools[0].name).toBe('kb_create_project');
    expect(pi.tools[1].name).toBe('kb_list_projects');
  });
});
