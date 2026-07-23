import { dirname } from "node:path";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { rebuildMetadata } from "../lib/metadata";
import { getVaultPaths, readJson } from "../lib/vault";
import { searchByTag } from "../lib/recall";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".."); // ~/.pi/agent
const paths = getVaultPaths(root);

describe("registry run/status fields", () => {
  it("rebuildMetadata writes status and run fields", () => {
    rebuildMetadata(paths);

    const registry = readJson<Record<string, unknown>[]>(
      join(paths.meta, "registry.json")
    ) || [];

    expect(registry.length).toBeGreaterThan(0);

    for (const e of registry) {
      expect(e).toHaveProperty("status");
      expect(e).toHaveProperty("run");
    }
  });

  it("searchByTag filters by run and status", () => {
    // Status filter with non-matching value returns empty
    const statusResults = searchByTag(paths, paths, { status: "done" });
    expect(statusResults).toHaveLength(0);

    // Run filter with nonexistent value returns empty
    const runResults = searchByTag(paths, paths, { run: "NONEXISTENT-RUN" });
    expect(runResults).toHaveLength(0);

    // Combined tag+status filter still works (no pages have status=done with workflow tag)
    const combined = searchByTag(paths, paths, {
      tag: "workflow",
      status: "done",
    });
    expect(combined).toHaveLength(0);

    // Tag filter still works and returns objects with new fields
    const tagResults = searchByTag(paths, paths, { tag: "workflow" });
    expect(tagResults.length).toBeGreaterThan(0);
    for (const r of tagResults) {
      expect(r).toHaveProperty("status");
      expect(r).toHaveProperty("run");
    }
  });
});
