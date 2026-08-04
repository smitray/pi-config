# Git Commit Failure Modes — Handling Guide

## Not a git repo

```bash
git rev-parse --is-inside-work-tree    # exits non-zero
```

**Response:** "Not a git repo. Run `git init` or `cd` to a repo first."

## Nothing staged

```bash
git status --porcelain    # empty output, no staged files
```

**Response:** Show what's changed (`git diff --stat`), suggest:

```bash
git add -p <path>      # interactive — DON'T run this for the user
git add <path>         # specific paths
git add -A             # all (caution: may include secrets)
```

**Never auto-stage.** The user must explicitly say what to add.

## Pre-commit hook failure

```bash
git commit -m "..."     # exits non-zero with hook stderr
```

**Response:**
1. Show stderr verbatim
2. If hook modified files → tell user to `git add` the changes then re-commit
3. Don't try to bypass hooks

Common hook errors:
- Linter/formatter failure → fix the reported issues
- Prettier/Eslint errors → show file + line number
- TypeScript type errors → show compilation errors

## GPG signing issue

```bash
gpg: Signing failed: No secret key
```

**Response:** "GPG signing required but no key configured. Options: set `user.signingkey`, use `--no-gpg-sign`, or configure your signing key."

Stop after surfacing the error. Don't attempt to work around it programmatically.

## Empty message

```bash
git commit -m ""        # refuses to commit
```

**Response:** Compose a message from staged changes if possible, ask user to confirm.

## Working tree dirty but nothing staged

**Response:** Ask whether to stage everything or specific files.
```bash
git status                  # shows unstaged modifications
→ "Working tree has X unstaged changes. Stage all or specific files?"
```

## User denies approval

If the user says "no" to the composed message: **Don't commit. Don't argue.** Ask if they want to adjust the message or abort entirely.
