---
name: git-commit
description: >
  Compose and run git commits that follow the Conventional Commits specification with
  emoji prefixes (e.g. "🎉 feat(api): add rate limiter"). Use when the user asks you to
  commit staged changes, write a commit message, or follow Conventional Commits format.
  Handles empty stage, type/scope/breaking-change formatting, and pre-commit hook errors.
compatibility: >
  No extension required — this skill instructs the model to use the core `bash` tool to run
  `git` commands. Requires a working `git` install and a git repository (cwd must be inside
  one, or one of its parents).
---

# git-commit (Conventional Commits with emojis)

A skill that teaches the model how to compose and run commits following the
[Conventional Commits 1.0](https://www.conventionalcommits.org/) spec, prefixed with
the popular emoji style. The model uses the core `bash` tool to run `git` directly.

## When to use this skill

- The user asks to commit changes and Conventional Commits format is implied.
- The user says "commit this" after the model staged files.
- The user asks for a feat / fix / chore commit message.

If the user just wants `git commit -m "..."` with whatever string they dictate, do that
directly without invoking this skill's workflow.

## Workflow

```
1. Inspect stage
2. Pick the type and scope (auto-detect only when trivially obvious)
3. Compose the message
4. Show the message to the user; let them adjust
5. Run git commit
6. Report
```

### Step 1 — Inspect stage

```bash
git rev-parse --is-inside-work-tree     # confirm git repo; bail with "not a git repo" if not
git status --porcelain                  # see staged vs unstaged
git diff --cached --stat                # what will be committed
git log --oneline -5                    # recent commit style (emoji prefix or not?)
```

If nothing is staged, say so and **suggest** one of:

```bash
git add -p <path>      # interactive — DON'T run this for the user
git add <path>         # specific paths
git add -A             # all (caution: may include secrets)
```

Never auto-stage. The user must say what to add.

### Step 2 — Pick type and scope

Emoji-to-type table:

| Emoji | Type | When |
|-------|------|------|
| 🎉 | `feat` | A new feature |
| 🐛 | `fix` | A bug fix |
| 📝 | `docs` | Documentation only changes |
| 💄 | `style` | Formatting, missing semicolons, no code change |
| ♻️ | `refactor` | Refactor code without adding features or fixing bugs |
| ⚡ | `perf` | Performance improvement |
| ✅ | `test` | Add or fix tests |
| 📦 | `build` | Build system or external deps |
| 👷 | `ci` | CI configuration |
| 🔧 | `chore` | Other changes that don't modify src or test files |
| ⏪ | `revert` | Revert a previous commit |

**Auto-detect only when trivially obvious:**

- Every staged file ends in `.md` → `docs` (📝)
- Every staged file matches `*.test.*` or `*.spec.*` → `test` (✅)
- Every staged file is in `docs/` or `documentation/` → `docs` (📝)

**Otherwise, ask the user for the type.** Don't guess — `feat` vs `fix` is hard to
infer from a diff and getting it wrong creates noisy history.

Scope is the optional noun in parens describing the section of the codebase: `(api)`,
`(cli)`, `(deps)`. Infer from the path if obvious; otherwise ask.

### Step 3 — Compose the message

Format:

```
{emoji} {type}{scope?}: {description}

[optional body — wrap at 72 chars]

[optional footer — e.g. BREAKING CHANGE: description, Refs: #123, Co-authored-by: ...]
```

Rules:
- Description is imperative mood, lowercase, no trailing period, ≤ 72 chars.
- `scope` is wrapped in parens: `feat(api):`, never `feat api:`.
- Breaking change: append `!` after type/scope (`feat(api)!:`) AND add a footer:
  ```
  BREAKING CHANGE: <what broke and how to migrate>
  ```
- Body and footer are separated from the description and from each other by blank lines.
- Wrap body at 72 chars; wrap footer lines at 72 chars.

Examples:

```
🎉 feat(api): add rate limiter
🐛 fix(cli): handle missing config file
📝 docs: document emoji commit convention
♻️ refactor!: drop Node 16 support

BREAKING CHANGE: requires Node 18 or later
```

Without emoji (if the repo doesn't use them, e.g. user opts out):

```
feat(api): add rate limiter
```

### Step 4 — Show the user

Always show the composed message **before** running `git commit`. The user can:
- approve as-is
- tweak the wording
- change the type
- drop the emoji
- abort

### Step 5 — Run git commit

Prefer a single `-m` if the message is one line. Use multiple `-m` flags for
multi-paragraph:

```bash
git commit -m "🎉 feat(api): add rate limiter" \
           -m "Adds a sliding-window rate limiter using Redis." \
           -m "BREAKING CHANGE: requires REDIS_URL to be set"
```

Each `-m` becomes its own paragraph; they're separated by blank lines in the commit.

For amend:

```bash
git commit --amend -m "🎉 feat(api): add rate limiter (revised)"
```

### Step 6 — Report

After commit, return:

```
sha: <short SHA from `git rev-parse --short HEAD`>
message: <the committed message>
files: <N files changed, +X -Y from `git show --stat HEAD`>
```

## Failure modes to handle

| Symptom | Response |
|---------|----------|
| `git rev-parse --is-inside-work-tree` exits non-zero | "Not a git repo. Run `git init` or `cd` to a repo first." |
| Nothing staged | Show `git status`, suggest `git add`. Don't auto-add. |
| `git commit` exits non-zero | Show stderr verbatim. Likely culprits: pre-commit hook failure, GPG signing issue, empty message (rare). |
| Pre-commit hook modified files | Tell the user, suggest `git add` the hook's changes then re-commit. |
| User denies approval | Don't commit. Don't argue. |
| Working tree dirty but nothing staged | Ask whether to stage everything or specific files. |

## Patterns

### Pattern: small bugfix

```
git status        # see what's changed
git diff --stat   # confirm scope
→ User says: "fix the bug"
git add <paths>   # user specifies paths
→ compose: 🐛 fix(auth): handle expired refresh tokens
git commit -m "🐛 fix(auth): handle expired refresh tokens"
```

### Pattern: feature with body

```
→ compose:
   🎉 feat(api): add /v2/search endpoint

   Adds the new search endpoint backed by the indexed cache.
   Supports `q`, `limit`, and `offset` query params.

git commit -m "🎉 feat(api): add /v2/search endpoint" \
           -m "Adds the new search endpoint backed by the indexed cache." \
           -m "Supports \`q\`, \`limit\`, and \`offset\` query params."
```

### Pattern: breaking change

```
→ compose:
   ♻️ refactor(config)!: require explicit env loading

   BREAKING CHANGE: implicit .env loading removed; call `loadEnv()`
   at startup instead.

git commit -m "♻️ refactor(config)!: require explicit env loading" \
           -m "BREAKING CHANGE: implicit .env loading removed; call \`loadEnv()\` at startup instead."
```

### Pattern: amend a recent commit

```
git log --oneline -1              # confirm the commit
→ user: "amend with a better message"
git commit --amend -m "🎉 feat(api): add rate limiter with exponential backoff"
```

## What this skill is NOT

- Not a branch manager. Use `gh` extension tools for branches, PRs, merges.
- Not a hook manager. Pre-commit / pre-push hooks are external to this skill.
- Not opinionated on GPG signing. If the user's repo demands signed commits, `git commit`
  will fail without `user.signingkey` set — surface that error and stop.

## Variation: no emoji

Some repos don't use emoji prefixes. If the user opts out (or the project's recent
history has no emoji), drop the emoji but keep the rest of the format:

```bash
git commit -m "feat(api): add rate limiter"
```

Detect this by inspecting `git log --oneline -5` — if the most recent commits don't
start with an emoji, follow suit.
