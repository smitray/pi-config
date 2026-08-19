import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { err, ok } from '../../_shared/result';
import { buildVaultPaths, fmtDate, readJson, resolveVaultContext, type VaultPaths } from './vault';

// ─── The nine role packages ─────────────────────────────────────
// Roles are the unit of skill distribution. Each role page (wiki/agents/)
// lists the skills loaded when a subagent with that role is spawned.

export interface RoleDef {
  name: string;
  scope: string;
  skills: string[];
}

export const ROLES: RoleDef[] = [
  {
    name: 'orchestrator',
    scope: 'Runs flows, routes stages, spawns subagents, records handoffs.',
    skills: ['kb-flow', 'grill-me', 'handoff', 'decision-mapping', 'ask-matt'],
  },
  {
    name: 'designer',
    scope: 'Designs architecture, interfaces, and domain language.',
    skills: ['codebase-design', 'design-an-interface', 'ubiquitous-language', 'domain-modeling'],
  },
  {
    name: 'implementer',
    scope: 'Writes code test-first, prototypes, implements.',
    skills: ['tdd', 'prototype', 'implement'],
  },
  {
    name: 'reviewer',
    scope: 'Reviews diffs and PRs against standards and spec.',
    skills: ['code-review', 'review', 'qa'],
  },
  {
    name: 'researcher',
    scope: 'Investigates questions, zooms out to see the whole problem.',
    skills: ['research', 'zoom-out'],
  },
  {
    name: 'diagnoser',
    scope: 'Diagnoses failures and bugs from symptoms to root cause.',
    skills: ['diagnose', 'diagnosing-bugs'],
  },
  {
    name: 'onboarder',
    scope: 'Bootstraps projects and reads the codebase for context.',
    skills: ['setup-matt-pocock-skills', 'zoom-out', 'ubiquitous-language'],
  },
  {
    name: 'architect',
    scope: 'Improves codebase architecture, maps decision spaces.',
    skills: ['improve-codebase-architecture', 'decision-mapping'],
  },
  {
    name: 'writer',
    scope: 'Shapes writing structure, fragments, and beats.',
    skills: ['writing-shape', 'writing-fragments', 'writing-beats'],
  },
];

export function rolePagePath(paths: VaultPaths, name: string): string {
  return join(paths.wiki, 'agents', `role-${name}.md`);
}

export function roleRegistryPath(paths: VaultPaths): string {
  return join(paths.meta, 'roles.json');
}

export interface RoleRegistryEntry {
  name: string;
  skills: string[];
  installed: Record<string, boolean>;
}

export function loadRoleRegistry(paths: VaultPaths): RoleRegistryEntry[] {
  return readJson<RoleRegistryEntry[]>(roleRegistryPath(paths)) ?? [];
}

/** A skill counts as installed when a SKILL.md exists under an agent skills dir. */
export function isSkillInstalled(skill: string): boolean {
  const home = process.env.HOME || homedir();
  const dirs = [
    join(home, '.pi', 'agent', 'skills'),
    join(home, '.pi', 'agent', 'git', 'github.com', 'DietrichGebert', 'ponytail', 'skills'),
  ];
  for (const dir of dirs) {
    if (existsSync(join(dir, skill, 'SKILL.md'))) return true;
  }
  return false;
}

export function installedSkillNames(): string[] {
  const home = process.env.HOME || homedir();
  const names = new Set<string>();
  const dirs = [
    join(home, '.pi', 'agent', 'skills'),
    join(home, '.pi', 'agent', 'git', 'github.com', 'DietrichGebert', 'ponytail', 'skills'),
  ];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (existsSync(join(dir, name, 'SKILL.md'))) names.add(name);
    }
  }
  return [...names];
}

/** Write a role page (entity type) into wiki/agents/. */
export function writeRolePage(paths: VaultPaths, role: RoleDef): string {
  const dir = join(paths.wiki, 'agents');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const skills = role.skills.map((s) => `"${s}"`).join(', ');
  const content = [
    '---',
    `title: "role-${role.name}"`,
    'type: entity',
    'category: role',
    `skills: [${skills}]`,
    `created: "${fmtDate()}"`,
    `updated: "${fmtDate()}"`,
    'stage: production',
    '---',
    '',
    `# Role: ${role.name}`,
    '',
    '## Scope',
    '',
    role.scope,
    '',
    '## Skills',
    '',
    ...role.skills.map((s) => `- \`${s}\``),
    '',
    '## Inputs / Outputs',
    '',
    'Consumes handoffs from the previous stage; produces a handoff for the next stage.',
    '',
  ].join('\n');
  const file = rolePagePath(paths, role.name);
  if (!existsSync(file)) writeFileSync(file, content, 'utf-8');
  return file;
}

/** Write all role pages + registry. Idempotent — skips existing pages. */
export function writeAllRoles(paths: VaultPaths): RoleRegistryEntry[] {
  const installed = new Set(installedSkillNames());
  const registry: RoleRegistryEntry[] = ROLES.map((role) => {
    writeRolePage(paths, role);
    return {
      name: role.name,
      skills: role.skills,
      installed: Object.fromEntries(role.skills.map((s) => [s, installed.has(s)])),
    };
  });
  writeFileSync(roleRegistryPath(paths), JSON.stringify(registry, null, 2), 'utf-8');
  return registry;
}

// ─── Tools ──────────────────────────────────────────────────────

export function registerRoleTools(pi: ExtensionAPI): void {
  // ─── kb_role_install ─────────────────────────────────────────
  pi.registerTool({
    name: 'kb_role_install',
    label: 'KB Role Install',
    description:
      'Install or extend a role: adds the skill to the role page and registry, ' +
      'marks install status. Idempotent. skill=<name> adds a single skill to the role.',
    promptSnippet: 'Install a role package',
    promptGuidelines: [
      'Use kb_role_install to manage role skill bundles. Subagent roles load only their listed skills.',
    ],
    parameters: Type.Object({
      role: Type.String({
        description:
          'Role name (orchestrator, designer, implementer, reviewer, researcher, diagnoser, onboarder, architect, writer)',
      }),
      skill: Type.Optional(Type.String({ description: 'Skill name to add to the role' })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd ?? process.cwd();
      const { root } = resolveVaultContext(cwd);
      const paths = buildVaultPaths(root);
      if (!existsSync(join(paths.dotKb, 'config.json'))) {
        return err('NO_VAULT', 'No KB vault found. Run `kb_bootstrap` first.');
      }

      const role = ROLES.find((r) => r.name === params.role);
      if (!role) {
        return err(
          'NO_ROLE',
          `Unknown role: ${params.role}. Known: ${ROLES.map((r) => r.name).join(', ')}`
        );
      }

      // Add a single skill to the role page.
      if (params.skill) {
        const file = rolePagePath(paths, role.name);
        if (existsSync(file)) {
          const { readFileSync } = await import('node:fs');
          const content = readFileSync(file, 'utf-8');
          if (!role.skills.includes(params.skill)) {
            role.skills.push(params.skill);
            const skills = role.skills.map((s) => `"${s}"`).join(', ');
            const updated = content
              .replace(/(^skills: \[).*?(\])/m, `$1${skills}$2`)
              .replace(/(^## Skills\s*\n)/, `$1\n- \`${params.skill}\`\n`);
            writeFileSync(file, updated, 'utf-8');
          }
        }
      }

      const registry = writeAllRoles(paths);
      const entry = registry.find((e) => e.name === params.role);
      if (!entry) return err('NO_ROLE', `Role disappeared: ${params.role}`);
      const installedCount = Object.values(entry.installed).filter(Boolean).length;
      const lines = [
        `# Role: ${params.role}`,
        '',
        '| Skill | Installed |',
        '|-------|-----------|',
        ...entry.skills.map((s) => `| \`${s}\` | ${entry.installed[s] ? '✅' : '⬜'} |`),
        '',
        `**${installedCount}/${entry.skills.length} skills installed.**`,
        params.skill ? `\nAdded \`${params.skill}\` to role ${params.role}.` : '',
      ];
      return ok(lines.join('\n'), {
        role: params.role,
        skills: entry.skills,
        installed: entry.installed,
      });
    },
  });

  // ─── kb_role_list ────────────────────────────────────────────
  pi.registerTool({
    name: 'kb_role_list',
    label: 'KB Role List',
    description: 'Shows all roles, their skills, and install status.',
    promptSnippet: 'List role packages',
    promptGuidelines: ['Use kb_role_list to see the role catalog and which skills are installed.'],
    parameters: Type.Object({}),
    async execute(_id, _params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd ?? process.cwd();
      const { root } = resolveVaultContext(cwd);
      const paths = buildVaultPaths(root);

      const registry = loadRoleRegistry(paths);
      const lines = [
        '# Role Packages',
        '',
        '| Role | Skills | Installed |',
        '|------|--------|-----------|',
        ...registry.map((r) => {
          const installedCount = Object.values(r.installed).filter(Boolean).length;
          return `| ${r.name} | ${r.skills.join(', ')} | ${installedCount}/${r.skills.length} |`;
        }),
        '',
        '_Skills marked ⬜ are not installed. Use `kb_role_install role=<name>` to check status; install via pi/npx skills._',
      ];
      return ok(lines.join('\n'), { roles: registry });
    },
  });
}
