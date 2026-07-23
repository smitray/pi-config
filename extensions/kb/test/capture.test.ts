import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { captureFile, captureText } from "../lib/capture";
import {
  buildVaultPaths,
  ensureVaultStructure,
  fmtDate,
  writeJson,
} from "../lib/vault";

const TMP = join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".kb-test-capture");
const paths = buildVaultPaths(TMP);

beforeEach(() => {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  ensureVaultStructure(paths);
  writeJson(join(paths.dotKb, "config.json"), {
    topic: "test",
    mode: "project",
    created: fmtDate(),
    version: "1.0",
  });
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe("captureText", () => {
  it("creates a source packet from raw text", () => {
    const result = captureText("hello world", "test text capture", paths);
    expect(result.sourceId).toMatch(/^SRC-/);
    expect(result.packetDir).toContain("raw/sources");
    expect(existsSync(join(result.packetDir, "original", "content.txt"))).toBe(true);
    expect(existsSync(join(result.packetDir, "extracted.md"))).toBe(true);
    expect(existsSync(join(result.packetDir, "manifest.json"))).toBe(true);
  });

  it("preserves text in extracted.md", () => {
    const result = captureText(
      "# Heading\n\nSome **bold** text",
      "markdown test",
      paths
    );
    const extracted = readFileSync(join(result.packetDir, "extracted.md"), "utf-8");
    expect(extracted).toContain("# Heading");
    expect(extracted).toContain("**bold**");
  });
});

describe("captureFile", () => {
  it("creates a source packet from an existing file", () => {
    const srcPath = join(TMP, "sample.md");
    writeFileSync(srcPath, "# Sample file\n\nContent here", "utf-8");

    const result = captureFile(srcPath, "test file capture", paths);
    expect(result.sourceId).toMatch(/^SRC-/);
    expect(existsSync(join(result.packetDir, "original", "sample.md"))).toBe(true);
    expect(existsSync(join(result.packetDir, "extracted.md"))).toBe(true);
    expect(existsSync(join(result.packetDir, "manifest.json"))).toBe(true);
  });

  it("preserves file content", () => {
    const srcPath = join(TMP, "sample2.md");
    writeFileSync(srcPath, "exact content", "utf-8");

    const result = captureFile(srcPath, "test file 2", paths);
    const original = readFileSync(
      join(result.packetDir, "original", "sample2.md"),
      "utf-8"
    );
    expect(original).toBe("exact content");
  });

  it("rejects PDF files", () => {
    const srcPath = join(TMP, "sample.pdf");
    writeFileSync(srcPath, "fake pdf", "utf-8");
    expect(() => captureFile(srcPath, "pdf test", paths)).toThrow("PDF detected");
  });
});
