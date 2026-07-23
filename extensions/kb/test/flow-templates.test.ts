import { describe, expect, it } from "vitest";
import { buildPage } from "../lib/templates";
import type { PageType } from "../lib/templates";
import { buildVaultPaths } from "../lib/vault";

// Test vault in /tmp
const paths = buildVaultPaths("/tmp/.kb-test-templates");

const FLOW_FIELDS = {
  run: "RUN-2026-07-23-001",
  started_at: "2026-07-23T09:00:00+05:30",
  completed_at: "2026-07-23T09:15:00+05:30",
  execution_time: "15m",
  depends_on: ["research/auth-2026-07-23-v1"],
  related_pages: ["research/auth-2026-07-23-v1"],
  todos: ["- [x] scaffold", "- [ ] tests"],
  gortex_refs: ["extensions/kb/index.ts::KNOWLEDGE_KEYWORDS"],
};

describe("flow fields in buildPage", () => {
  it("builds plan with full flow fields", () => {
    const { content } = buildPage("plan", "auth-middleware-2026-07-23-v1", paths, {
      tags: ["flow"],
      ...FLOW_FIELDS,
      depends_on: FLOW_FIELDS.depends_on,
      related_pages: FLOW_FIELDS.related_pages,
      gortex_refs: FLOW_FIELDS.gortex_refs,
      id: "PLAN-999",
      status: "in_progress",
      scope: "large",
      priority: "high",
      shared: "false",
    });
    expect(content).toContain('run: "RUN-2026-07-23-001"');
    expect(content).toContain('"2026-07-23T09:00:00+05:30"');
    expect(content).toContain('"15m"');
    expect(content).toContain("## Context Snapshot");
    expect(content).toContain("RUN-2026-07-23-001");
  });

  it("builds research with full flow fields", () => {
    const { content } = buildPage("research", "auth-2026-07-23-v1", paths, {
      tags: ["flow"],
      ...FLOW_FIELDS,
      depends_on: FLOW_FIELDS.depends_on,
      related_pages: FLOW_FIELDS.related_pages,
      gortex_refs: FLOW_FIELDS.gortex_refs,
      id: "RES-999",
      status: "exploring",
      confidence: "partial",
      sources_count: "3",
      shared: "false",
    });
    expect(content).toContain('run: "RUN-2026-07-23-001"');
    expect(content).toContain('"15m"');
    expect(content).toContain("## Context Snapshot");
  });

  it("builds artifact with full flow fields", () => {
    const { content } = buildPage("artifact", "auth-2026-07-23-v1", paths, {
      tags: ["flow"],
      ...FLOW_FIELDS,
      depends_on: FLOW_FIELDS.depends_on,
      related_pages: FLOW_FIELDS.related_pages,
      gortex_refs: FLOW_FIELDS.gortex_refs,
      status: "in_progress",
    });
    expect(content).toContain('run: "RUN-2026-07-23-001"');
    expect(content).toContain('"15m"');
    expect(content).toContain("## Context Snapshot");
  });

  it("builds analysis with full flow fields", () => {
    const { content } = buildPage("analysis", "auth-review-2026-07-23-v1", paths, {
      tags: ["flow"],
      ...FLOW_FIELDS,
      depends_on: FLOW_FIELDS.depends_on,
      related_pages: FLOW_FIELDS.related_pages,
      gortex_refs: FLOW_FIELDS.gortex_refs,
      status: "draft",
    });
    expect(content).toContain('run: "RUN-2026-07-23-001"');
    expect(content).toContain('"15m"');
    expect(content).toContain("## Context Snapshot");
  });

  it("builds diary with run and status", () => {
    const { content } = buildPage("diary", "auth-commit-2026-07-23", paths, {
      tags: ["flow"],
      run: "RUN-2026-07-23-001",
      status: "published",
    });
    expect(content).toContain('run: "RUN-2026-07-23-001"');
    expect(content).toContain('status: "published"');
    expect(content).toContain("## Context Snapshot");
  });

  it("builds plan without flow fields uses empty defaults", () => {
    const { content } = buildPage("plan", "test-page", paths, { tags: [], id: "PLAN-001", status: "draft", scope: "small", priority: "low", shared: "false" });
    expect(content).not.toContain("{{run}}");
    expect(content).not.toContain("{{started_at}}");
    expect(content).toContain("## Context Snapshot");
    expect(content).toContain('run: ""');
  });
});
