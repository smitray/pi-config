---
name: skill-creator
description: >
  Template and standard protocol for creating Pi agent skills. Use when adding a new skill,
  reviewing an existing skill's structure, or understanding how skills are discovered and loaded
  by pi. Covers frontmatter rules, progressive disclosure, placement, consistency checks, and
  anti-patterns. Full protocol in references/protocol.md; examples in references/examples.md.
license: MIT
---

# Skill Creator

Standard protocol for creating and reviewing Pi agent skills.

## Quick Reference

A skill is a directory with one `SKILL.md`. Everything else is bundled resources.

```
my-skill/
├── SKILL.md           # Minimal: frontmatter + workflow (<30 lines ideal)
├── references/        # Detailed docs, loaded on-demand
│   ├── protocol.md    # Full spec (skip if trivial)
│   └── api-reference.md  # Per-domain details
├── scripts/           # Executables for repetitive tasks
└── assets/            # Templates, icons, configs
```

## Progressive Disclosure

Only descriptions live in context. The model loads full SKILL.md on trigger, then reads referenced files lazily.

| Level | What | Budget |
|---|---|---|
| Metadata | name + description | ~100 words |
| SKILL.md body | Workflow + key patterns | <500 lines |
| Bundled resources | As needed via relative links | Unlimited |

If SKILL.md approaches 500 lines, extract to `references/`. Keep the main file focused on **how to use**, not **every detail**.

## Frontmatter (Required)

```yaml
---
name: my-skill                    # lowercase, hyphens, max 64 chars
description: >                    # Max 1024 chars, "Use when..." style
  What it does + when to trigger.
compatibility: >                  # Optional but recommended
  Dependencies: extension required, env vars, etc.
---
```

Description best practices:
- Start with what it does, end with trigger pattern
- Include both capability and context: "extract PDF forms. Use when working with PDF documents"
- Be slightly pushy — LLMs under-trigger — list synonyms/edge cases at the end

## SKILL.md Structure (Minimal)

See [Full Protocol](references/protocol.md) for detailed sections.

Core sections that MUST exist:
1. **When to use** — scenario-to-tool mapping table
2. **Quick start** — most common invocation(s)
3. **Error handling** — error code → response table
4. **Scope boundaries** — what this does NOT do

Everything else is optional and belongs in `references/` if large.

## Placement

| Scenario | Where |
|---|---|
| Wraps tools from your own extension | `extensions/<ext>/skills/<name>/SKILL.md` |
| General-purpose, no extension dependency | `skills/<name>/SKILL.md` |

No `skills/` subdirectories within extensions per AGENTS.md convention.

## Consistency Checklist

Before committing a new skill:
- [ ] `name` matches directory name
- [ ] `description` follows "Use when..." pattern, ≤1024 chars
- [ ] No duplication of tool docs already in another skill
- [ ] `compatibility` lists all dependencies
- [ ] Has error handling section
- [ ] Has scope boundary ("does NOT")
- [ ] Body <500 lines (or references/ created for overflow)
- [ ] Links to related skills where relevant

## Anti-Patterns

- ❌ One massive SKILL.md with every parameter for every tool
- ❌ Workflow skills that duplicate their reference skills' content
- ❌ Descriptions too vague: "Helps with X" instead of "Do X. Use when Y."
- ❌ Skills referencing non-existent scripts/tools
- ❌ Multiple skills covering the same tool with different docs

## Related

See [examples](references/examples.md) for concrete patterns from real skills.
