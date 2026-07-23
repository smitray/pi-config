import { describe, expect, it, vi } from "vitest";
import {
  registerContentTool,
  registerLibraryTool,
  registerPlanTool,
  registerProjectTools,
  registerResearchTool,
  registerScheduleTool,
  registerTicketTool,
  registerTodoTool,
} from "../lib/create-tools";

function makePi() {
  const tools: Array<{ name: string; label: string; parameters: unknown }> = [];
  return {
    tools,
    registerTool(def: {
      name: string;
      label: string;
      parameters: unknown;
    }) {
      tools.push(def);
    },
    on: vi.fn(),
    registerCommand: vi.fn(),
  };
}

const TOOLS = [
  { name: "registerScheduleTool", fn: registerScheduleTool, toolName: "kb_create_schedule" },
  { name: "registerLibraryTool", fn: registerLibraryTool, toolName: "kb_create_library" },
  { name: "registerResearchTool", fn: registerResearchTool, toolName: "kb_create_research" },
  { name: "registerPlanTool", fn: registerPlanTool, toolName: "kb_create_plan" },
  { name: "registerContentTool", fn: registerContentTool, toolName: "kb_create_content" },
  { name: "registerTicketTool", fn: registerTicketTool, toolName: "kb_create_ticket" },
  { name: "registerTodoTool", fn: registerTodoTool, toolName: "kb_create_todo" },
];

for (const { name, fn, toolName } of TOOLS) {
  describe(name, () => {
    it(`registers ${toolName} tool`, () => {
      const pi = makePi() as Parameters<typeof fn>[0];
      fn(pi);
      expect(pi.tools).toHaveLength(1);
      expect(pi.tools[0].name).toBe(toolName);
    });

    it("has required title parameter", () => {
      const pi = makePi() as Parameters<typeof fn>[0];
      fn(pi);
      const props = (pi.tools[0].parameters as { properties: Record<string, unknown> }).properties;
      expect(props).toHaveProperty("title");
    });
  });
}

describe("registerProjectTools", () => {
  it("registers kb_create_project and kb_list_projects", () => {
    const pi = makePi() as Parameters<typeof registerProjectTools>[0];
    registerProjectTools(pi);
    expect(pi.tools).toHaveLength(2);
    expect(pi.tools[0].name).toBe("kb_create_project");
    expect(pi.tools[1].name).toBe("kb_list_projects");
  });
});
