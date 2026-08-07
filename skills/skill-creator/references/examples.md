# Skill Examples — Concrete Patterns from This Codebase

Good examples of each pattern. Use as references when creating new skills.

## Minimal Skill (≤50 lines)

**flashback** — thin workflow skill, everything fits in SKILL.md.

```markdown
---
name: flashback
description: >
  Search past Pi sessions by date via scripts/flashback.mjs — reads pi session
  JSONL files (observations/reflections written by pi-blackhole) plus git commits.
  Use when the user asks 'what did I do yesterday', 'what happened on Monday',
  'show me last activity', or any question about PAST session work.
compatibility: >
  Reads ~/.pi/agent/sessions/**/*.jsonl. git for commit summaries. Node >= 18.
---

# Flashback

Answer "what did I do [when]" from past Pi sessions.

## When to Use

| User asks | Run |
|---|---|
| What did I do yesterday? | `node scripts/flashback.mjs yesterday` |
| What happened on [date]? | `node scripts/flashback.mjs YYYY-MM-DD` |
| Last week | `node scripts/flashback.mjs "last 7 days"` |

## Usage

```text
node scripts/flashback.mjs [date] [keyword...] [--verbose]
```

Output: git commits for the day, then `[observation]`/`[reflection]` entries
with timestamps. Run from the skill directory.

## Error Handling

| Symptom | Response |
|---|---|
| `Unknown date` | yesterday / today / last N days / YYYY-MM-DD only |
| No memories found | report git commits + session count; widen window |
| ENOENT sessions | pi session storage moved; verify ~/.pi/agent/sessions |

## What This Skill Does NOT Do

- Does NOT search the current session — use the `recall` tool
- Does not compact sessions (use `/blackhole`)
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
