---
name: git-commit
description: >
  Compose and run git commits following Conventional Commits spec with emoji prefixes. Use when
  the user asks to commit staged changes, write a commit message, or follow Conventional Commits format.
  Handles empty stage, type/scope detection, breaking change formatting, and hook errors.
license: MIT
metadata:
  author: "Debasmita"
---

# git-commit (Conventional Commits with emojis)

Compose and run commits following [Conventional Commits 1.0](https://www.conventionalcommits.org/) spec.

## Workflow

```
1. Inspect staged changes   → git status, git diff --cached
2. Pick type and scope       → auto-detect trivially obvious cases only
3. Compose message           → {emoji} {type}{scope!}?: {desc}
4. Show to user              → approve or adjust
5. Run git commit            → single -m or multi-line -m flags
6. Report                    → sha, message, files changed
```

See [full patterns](references/patterns.md) for complex scenarios.

## Emoji → Type Map

| Emoji | Type | When |
|---|---|---|
| 🎉 | `feat` | New feature |
| 🐛 | `fix` | Bug fix |
| 📝 | `docs` | Documentation only |
| 💄 | `style` | Formatting, no code change |
| ♻️ | `refactor` | Refactoring without behavior change |
| ⚡ | `perf` | Performance improvement |
| ✅ | `test` | Add or fix tests |
| 📦 | `build` | Build system / deps |
| 👷 | `ci` | CI configuration |
| 🔧 | `chore` | Other non-source changes |
| ⏪ | `revert` | Revert previous commit |

Auto-detect only when trivially obvious (all `.md` → docs, all `*.spec.*` → test). Otherwise ask the user.

## Message Format

```
{emoji} {type}{scope?}!: {description}

[optional body]

[optional footer]
```

Rules:
- Description: imperative mood, lowercase, no trailing period, ≤72 chars
- Scope: wrapped in parens `(api):`, never `feat api:`
- Breaking change: `!` after type/scope AND `BREAKING CHANGE:` footer
- Body/footer separated by blank lines, wrap at 72 chars

Examples:
```
🎉 feat(api): add rate limiter
🐛 fix(cli): handle missing config file
♻️ refactor(config)!: require explicit env loading

BREAKING CHANGE: implicit .env loading removed; call loadEnv() instead.
```

Without emoji (if repo history shows no emoji):
```
feat(api): add rate limiter
```

## Commands

One-line message:
```bash
git commit -m "🎉 feat(api): add rate limiter"
```

Multi-paragraph:
```bash
git commit -m "🎉 feat(api): add rate limiter" \
           -m "Sliding-window implementation using Redis." \
           -m "BREAKING CHANGE: requires REDIS_URL"
```

Amend:
```bash
git commit --amend -m "🎉 feat(api): add rate limiter (revised)"
```

## Pre-Commit Checklist

```bash
git rev-parse --is-inside-work-tree    # must succeed
git status --porcelain                  # see staged vs unstaged
git diff --cached --stat                # what will be committed
git log --oneline -5                    # recent emoji style?
```

**Never auto-stage.** The user must specify what to add.

## Failure Modes

See [failure-modes.md](references/failure-modes.md) for detailed handling of:
- Not a git repo
- Nothing staged
- Pre-commit hook failure (modified files)
- GPG signing issues
- Empty message (rare)
- User denial of approval

## What This Skill Does NOT Do

- Not for branch management → use `gh` extension tools
- Not for push/fetch/pull → drop to bash with git CLI
- Not opinionated on GPG signing — surface error and stop if required
