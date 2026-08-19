import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { advanceFlow, completeFlow, FLOWS, getFlow, loopBackFlow, startFlow } from '../lib/flow';
import { createHandoff } from '../lib/handoffs';
import { lintWiki } from '../lib/lint';
import { rebuildMetadata } from '../lib/metadata';
import { loadRoleRegistry, ROLES, writeAllRoles } from '../lib/roles';
import { scaffoldProject } from '../lib/scaffold';
import { buildPage } from '../lib/templates';
import { buildVaultPaths, ensureVaultStructure, fmtDate, writeJson } from '../lib/vault';

const TMP = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.kb-test-v2');
const paths = buildVaultPaths(TMP);

beforeEach(() => {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  ensureVaultStructure(paths);
  writeJson(join(paths.dotKb, 'config.json'), {
    topic: 'v2 test',
    mode: 'project',
    created: fmtDate(),
    version: '2.0',
  });
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

// ─── Phase 2: handoff chains ────────────────────────────────────

describe('handoff chains', () => {
  it('stitches a linked list via from_handoff / to_handoff', () => {
    const h1 = createHandoff(paths, {
      stage: 'spec',
      task: 'TASK-001',
      project: 'PROJ-001',
      status: 'done',
      summary: 'spec written',
    });
    const h2 = createHandoff(paths, {
      stage: 'execute',
      task: 'TASK-001',
      project: 'PROJ-001',
      status: 'done',
      summary: 'code written',
    });
    const h3 = createHandoff(paths, {
      stage: 'test',
      task: 'TASK-001',
      project: 'PROJ-001',
      status: 'done',
      summary: 'tests pass',
    });

    expect(h1.fromHandoff).toBeNull();
    expect(h2.fromHandoff).toBe(h1.id);
    expect(h3.fromHandoff).toBe(h2.id);

    // Registry reflects the chain.
    const registry = JSON.parse(readFileSync(join(paths.meta, 'registry.json'), 'utf-8'));
    const hoffs = registry.filter((e: { type: string }) => e.type === 'handoff');
    expect(hoffs).toHaveLength(3);
    const idFromPath = (p: string) => p.match(/(HOFF-\d{8}-\d+)/)?.[1] ?? p;
    const byId = Object.fromEntries(hoffs.map((h: { id: string }) => [idFromPath(h.id), h]));
    expect(byId[h1.id].to_handoff).toBe(h2.id);
    expect(byId[h2.id].to_handoff).toBe(h3.id);
    expect(byId[h3.id].to_handoff).toBeFalsy();
  });

  it('records skip_reason for skipped stages', () => {
    const h = createHandoff(paths, {
      stage: 'brainstorm',
      task: 'TASK-002',
      project: 'PROJ-001',
      status: 'skipped',
      summary: 'skipped brainstorm',
      skipReason: 'codebase already has entity pages',
    });
    const content = readFileSync(join(paths.wiki, 'handoffs', `hoff-${h.id}.md`), 'utf-8');
    expect(content).toContain('skip_reason: "codebase already has entity pages"');
  });
});

// ─── Phase 3: flow engine ───────────────────────────────────────

describe('flow engine', () => {
  it('defines all 12 flows with ordered stages', () => {
    expect(FLOWS).toHaveLength(12);
    for (const f of FLOWS) {
      expect(f.stages.length).toBeGreaterThanOrEqual(2);
      expect(getFlow(f.name)).toBe(f);
    }
    // Tail shape: build flow ends with commit.
    expect(getFlow('build')?.stages.slice(-1)).toEqual(['commit']);
  });

  it('walks start → advance → complete, emitting a handoff per stage', () => {
    const start = startFlow(paths, 'build', 'PROJ-001', 'TASK-001', 'kick off');
    if ('error' in start) throw new Error(start.error);
    expect(start.handoffId).toMatch(/^HOFF-/);

    const a1 = advanceFlow(paths, start.run.runId);
    if ('error' in a1) throw new Error(a1.error);
    expect(a1.run.currentIndex).toBe(1);
    expect(a1.handoffId).toBeTruthy();

    // Loop back to design mid-build.
    const lb = loopBackFlow(paths, start.run.runId, 'design', 'spec drifted');
    if ('error' in lb) throw new Error(lb.error);
    expect(lb.run.currentIndex).toBe(1);

    // Advance back through the tail.
    const a2 = advanceFlow(paths, start.run.runId);
    if ('error' in a2) throw new Error(a2.error);
    expect(a2.run.currentIndex).toBe(2);
    const a3 = advanceFlow(paths, start.run.runId);
    if ('error' in a3) throw new Error(a3.error);
    expect(a3.run.currentIndex).toBe(3);
    const a4 = advanceFlow(paths, start.run.runId);
    if ('error' in a4) throw new Error(a4.error);
    expect(a4.run.currentIndex).toBe(4);
    const fin = advanceFlow(paths, start.run.runId);
    if ('error' in fin) throw new Error(fin.error);
    expect(fin.finished).toBe(true);

    const done = completeFlow(paths, start.run.runId);
    if ('error' in done) throw new Error(done.error);
    expect(done.run.status).toBe('done');
  });

  it('rejects a second active run for the same task', () => {
    startFlow(paths, 'research', 'PROJ-001', 'TASK-001');
    const second = startFlow(paths, 'research', 'PROJ-001', 'TASK-001');
    expect('error' in second).toBe(true);
  });

  it('rejects unknown flows', () => {
    const res = startFlow(paths, 'nope', 'PROJ-001');
    expect('error' in res).toBe(true);
  });
});

// ─── Phase 4: role packages ─────────────────────────────────────

describe('role packages', () => {
  it('writes 9 role pages + registry', () => {
    const registry = writeAllRoles(paths);
    expect(ROLES).toHaveLength(9);
    expect(registry).toHaveLength(9);
    for (const role of ROLES) {
      expect(existsSync(join(paths.wiki, 'agents', `role-${role.name}.md`))).toBe(true);
    }
    expect(existsSync(join(paths.meta, 'roles.json'))).toBe(true);
  });

  it('registry is idempotent — rerun keeps 9 pages', () => {
    writeAllRoles(paths);
    const before = readFileSync(join(paths.wiki, 'agents', 'role-orchestrator.md'), 'utf-8');
    writeAllRoles(paths);
    const after = readFileSync(join(paths.wiki, 'agents', 'role-orchestrator.md'), 'utf-8');
    expect(after).toBe(before);
    expect(loadRoleRegistry(paths)).toHaveLength(9);
  });
});

// ─── Phase 5: scaffolding ───────────────────────────────────────

describe('kb_scaffold', () => {
  it('generates the full project layout', () => {
    scaffoldProject({
      topic: 'Scaffold Test',
      mode: 'project',
      root: TMP,
      issueTracker: 'local',
      firstAdrTitle: 'Use KB extension',
    });

    expect(existsSync(join(paths.dotKb, 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(paths.wiki, 'context', 'context.md'))).toBe(true);
    expect(existsSync(join(paths.wiki, 'agents', 'role-orchestrator.md'))).toBe(true);
    expect(existsSync(join(paths.wiki, 'adrs', 'adr-ADR-001.md'))).toBe(true);
    expect(existsSync(join(TMP, 'docs', 'adr', '0001-use-kb-extension.md'))).toBe(true);
    expect(existsSync(join(paths.meta, 'roles.json'))).toBe(true);
  });

  it('is idempotent — second run does not overwrite', () => {
    scaffoldProject({ topic: 'Scaffold Test', mode: 'project', root: TMP });
    const before = readFileSync(join(paths.dotKb, 'AGENTS.md'), 'utf-8');
    scaffoldProject({ topic: 'Scaffold Test', mode: 'project', root: TMP });
    const after = readFileSync(join(paths.dotKb, 'AGENTS.md'), 'utf-8');
    expect(after).toBe(before);
  });
});

// ─── Phase 1: lint v2 rules ─────────────────────────────────────

describe('lint v2 rules', () => {
  it('flags a direct wiki write (no frontmatter type)', () => {
    mkdirSync(join(paths.wiki, 'concepts'), { recursive: true });
    writeFileSync(
      join(paths.wiki, 'concepts', 'polluted.md'),
      '# Direct write\n\nno frontmatter',
      'utf-8'
    );
    rebuildMetadata(paths);

    const report = lintWiki(paths);
    expect(report.summary.noType).toBeGreaterThan(0);
  });

  it('flags broken handoff chain pointers', () => {
    const dir = join(paths.wiki, 'handoffs');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'hoff-HOFF-20260805-001.md'),
      '---\ntitle: "x"\ntype: handoff\nid: "HOFF-20260805-001"\nfrom_handoff: "HOFF-NOPE"\n---\n\nbody\n',
      'utf-8'
    );
    rebuildMetadata(paths);

    const report = lintWiki(paths);
    expect(report.summary.brokenChain).toBeGreaterThan(0);
  });

  it('flags derived_from referencing a missing source', () => {
    mkdirSync(join(paths.wiki, 'concepts'), { recursive: true });
    writeFileSync(
      join(paths.wiki, 'concepts', 'ghost.md'),
      '---\ntitle: "ghost"\ntype: concept\nderived_from: [SRC-2026-01-01-999]\n---\n\nbody\n',
      'utf-8'
    );
    rebuildMetadata(paths);

    const report = lintWiki(paths);
    expect(report.summary.badDerivedFrom).toBeGreaterThan(0);
  });

  it('flags role pages referencing uninstalled skills', () => {
    writeAllRoles(paths);
    rebuildMetadata(paths);
    const report = lintWiki(paths);
    expect(report.summary.roleSkillMissing).toBeGreaterThan(0);
  });
});

// ─── Templates: v2 types ────────────────────────────────────────

describe('v2 templates', () => {
  it('context page loads without ID', () => {
    const { content, filename } = buildPage('context', 'Project Context', paths, {
      tags: ['context'],
    });
    expect(content).toContain('type: context');
    expect(content).toContain('Ubiquitous Language');
    expect(filename).toBe('project-context.md');
  });

  it('adr page loads with ADR prefix', () => {
    const { content, filename } = buildPage('adr', 'Use KB extension', paths, {
      id: 'ADR-001',
      status: 'accepted',
      tags: ['decision'],
    });
    expect(content).toContain('type: adr');
    expect(content).toContain('id: "ADR-001"');
    expect(filename).toBe('adr-ADR-001.md');
  });
});
