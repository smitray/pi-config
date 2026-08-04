---
name: pr-ship
description: >
  Ship a PR end-to-end: commit, push, create PR, merge, cleanup branches, move to main.
  Use when the user says "ship it", "pr and merge", "ship this", or wants the full PR lifecycle.
compatibility: >
  Requires gh extension (gh CLI) and git-commit skill.
---

# pr-ship

One-shot: commit → push → PR create → merge → delete branches → checkout main → pull.

## When to use

| Scenario | Action |
|---|---|
| User says "ship it" | Run full workflow |
| User says "pr and merge" | Run full workflow |
| Branch has changes, user wants to merge | Run full workflow |

## Quick start

```text
1. git status            — verify changes exist
2. git add + git commit  — use git-commit skill (conventional + emoji)
3. git push -u origin    — push branch to remote
4. gh-pr-create          — create PR against main
5. gh pr merge --merge   — merge the PR
6. git checkout main     — switch to main
7. git pull              — pull latest
8. git branch -d <branch>           — delete local
9. git push origin --delete <branch> — delete remote
```

## Error handling

| Error | Cause | Response |
|---|---|---|
| `nothing to commit` | No staged changes | Ask user what to stage |
| `PR already exists` | Branch already has open PR | Merge existing PR instead |
| `branch not found` | Branch already deleted | Skip delete step |
| `merge conflict` | PR has conflicts | Stop, ask user to resolve |

## Scope boundaries

- Not for reviewing PRs → use normal code review
- Not for rebasing/squashing → only if user explicitly asks
- No auto-stage → user must specify what to add
- Not for branch management beyond cleanup → use `gh` tools directly
