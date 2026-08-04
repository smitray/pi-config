# Skill Examples — Concrete Patterns from This Codebase

Good examples of each pattern. Use as references when creating new skills.

## Minimal Skill (≤50 lines)

**om-recall** — thin workflow skill, everything fits in SKILL.md.

```markdown
---
name: om-recall
description: >
  Query observational memory from previous Pi sessions by date.
  Use when the user asks 'what did I do yesterday', ...
compatibility: >
  Requires npm:pi-observational-memory package.
---

# OM Recall

## When to Use

| Command | What it does |
|---|---|
| `/om:status` | Current OM status |
| `/om:view --date YYYY-MM-DD` | Observations for specific day |

## Usage

```text
recall(<12-char-hex-id>)   # recover exact source context
```

## Timezone

Configured in `settings.json` under `observational-memory.timezoneOffset`.
Override: `OM_TIMEZONE_OFFSET=5.5`
```

## Reference Skill (~200 lines)

**gh** — full tool documentation for extension tools.

Structure:
- Tool quick reference organized by category (repos, PRs, issues, search, gists, workflows)
- Parameters table per tool
- Error codes table
- Pattern section with real workflows
- Scope boundary ("does NOT do")

Key patterns:
- Every tool shows invocation syntax
- Errors are structured (`error_code` → response)
- Mutations warn about confirmation prompts
- Links to external docs where relevant

## Split Skill (Main + References)

When to split:
- Skill exceeds ~200 lines
- Contains domain-specific variants (e.g., AWS vs GCP vs Azure)
- Has deep parameter tables that most users don't need

Pattern:
```markdown
# In SKILL.md:
See [complete command reference](references/commands.md) for all flags.
For domain-specific setup, see [aws](references/aws.md), [gcp](references/gcp.md).
```

## Bad Example (What NOT to Do)

❌ **vague description**: "Helps with git" instead of "Compose commits following Conventional Commits spec. Use when the user says 'commit this' or asks for a feat/fix commit."

❌ **duplicate coverage**: web-search skill duplicating access-web's web-search section

❌ **referencing non-existent files**: pointing to `scripts/foo.sh` that doesn't exist

❌ **no scope boundaries**: not stating what the skill does NOT do

❌ **one giant file**: 300+ line SKILL.md with no references/ directory
