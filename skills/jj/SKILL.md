---
name: jj
description: >
  Git-compatible VCS with auto-rebasing, change IDs, working-copy-as-commit, and undo for everything.
  Use when working in a jj repo, choosing between git and jj workflows, recovering from bad
  rebases/merges via the operation log, or migrating a project to jj.
license: MIT
metadata:
  version: "0.34"
  homepage: "https://jj-vcs.dev"
---

# jj (Jujutsu)

Version control on top of Git. Subset you need daily. Rest lives in `jj help <cmd>`.

## Mental model — git vs jj

| Concept | git | jj |
|---|---|---|
| Working copy | Uncommitted dir | **A commit** that auto-amends on every command |
| Commit identity | SHA hash (changes on rewrite) | **Change ID** (stable across rewrites) + commit hash |
| Staging | `git add` | None — snapshot is automatic |
| Undo | `git reflog` + manual fix | `jj undo` — every operation is recorded and reversible |
| Conflicts | Block the rebase | Stored in the commit; descendants rebase over them |
| Branches | First-class | **Bookmarks** — optional, push-only-by-default |

Rule of thumb: if you find yourself writing `git stash`, you wanted `jj new`.

## Install

```bash
# Linux/Mac — prebuilt
curl -sSL https://github.com/jj-vcs/jj/releases/latest/download/jj -o ~/.local/bin/jj && chmod +x ~/.local/bin/jj

# Cargo
cargo install jj-cli --locked

# Homebrew
brew install jj

# Arch
pacman -S jujutsu
```

Requires `git >= 2.41`. Configure once:

```bash
jj config set --user user.name "Your Name"
jj config set --user user.email "you@example.com"
```

## Daily commands

| Task | git | jj |
|---|---|---|
| Init | `git init` | `jj git init` (creates `.jj/` + `.git/`) |
| Clone | `git clone <url>` | `jj git clone <url>` |
| Status | `git status` | `jj st` |
| Log | `git log --oneline` | `jj log` |
| Diff | `git diff` | `jj diff` |
| Record working copy | `git add . && git commit` | `jj describe` (message) — snapshot is automatic |
| New change on top | `git commit --allow-empty` | `jj new` |
| Amend last commit | `git commit --amend` | `jj squash` (moves WC into parent) |
| Edit an old commit | `git rebase -i <hash>` | `jj edit <rev>` |
| Undo last op | `git reflog` + reset | `jj undo` |
| Move change to parent | `git rebase -i` + fixup | `jj squash` / `jj squash -i` (interactive) |
| Split a commit | `git rebase -i` + edit | `jj split` |
| Branch | `git branch foo` | `jj bookmark create foo` |
| Switch branch | `git switch foo` | `jj switch` (only to detached commit) or `jj edit <rev>` |
| Push | `git push` | `jj git push` (bookmark movement only) |
| Pull | `git pull` | `jj git fetch` |
| Stash | `git stash` | `jj new` (or just leave the WC commit dirty) |
| Blame | `git blame` | `jj file blame` |
| Show file at rev | `git show <rev>:file` | `jj file show <rev> -- path` |

## Revsets — selecting commits

`jj log -r '<revset>'` filters log. Combinators:

| Sym | Meaning |
|---|---|
| `@` | Working-copy commit |
| `@-` | Parent of working copy |
| `root()` | Virtual root commit |
| `trunk()` | Alias for main branch bookmark (set on `jj git init`) |
| `all()` | Every commit in the repo |
| `bookmarks()` | All bookmark targets |
| `::x` | Ancestors of `x` (incl. `x`) |
| `x::` | Descendants of `x` (incl. `x`) |
| `x..y` | `y` minus ancestors of `x` (same as git) |
| `x \| y` | Union |
| `x & y` | Intersection |
| `~x` | Negation |
| `x-` / `x+` | Parent / children |

Examples:

```bash
jj log -r 'root()..@'           # everything up to and including @
jj log -r 'bookmarks()'         # only bookmarked commits
jj log -r 'description(regex:"^fix")'
jj log -r 'author(exact:"alice")'
```

## Conflicts

jj allows rebases with conflicts. The conflict lives in the commit, descendants stay updated.

```bash
jj st                                # see conflicted paths
jj new <rev-with-conflict>           # create WC on top of it
# edit conflict markers in files, then:
jj squash                            # move resolution into the conflicted commit
jj log                               # descendants auto-rebased
```

## Operation log — undo everything

Every `jj` command writes an op. Navigate freely:

```bash
jj op log                  # full history
jj op log --limit 20       # tail
jj undo                    # revert the last op
jj undo --at-op <id>       # revert a specific op
jj op show <id>            # what changed at this op
jj op restore <id>         # full repo state at that op
jj evolog -r @             # every recorded version of the WC commit
```

`jj undo` is the killer feature. Use it without fear.

## Interactive content moves

```bash
jj squash -i               # pick hunks to move into parent (built-in diff editor)
jj diffedit -r <rev>       # edit a commit's content without checking it out
jj split                   # split WC commit into two
jj split -r <rev>          # split an existing commit
jj absorb                  # move each WC hunk into the commit that last touched its lines
```

`jj absorb` is the closest thing to "auto-fixup" — great right before `jj push`.

## Git interop

```bash
jj git init                # wrap an existing .git in a jj repo
jj git clone <url>         # clone via jj, then sync with git
jj git push [-b <book>]    # push bookmarks
jj git fetch               # fetch remote tracking
jj git import              # pull git refs into jj state
jj git export              # write jj state back to git refs
```

A `jj` repo IS a git repo. Both tools work on the same on-disk data. CI, IDE, `gh pr` — all keep working.

## Config worth setting

```toml
# ~/.config/jj/config.toml
[user]
name = "Your Name"
email = "you@example.com"

[ui]
diff-editor = "builtin"    # or ":vim" / "meld"
default-command = "log"

[revset-aliases]
'wip()' = 'description(exact:"") | empty()'
```

## When to use git instead

- CI that doesn't know about jj (rare today — `jj git push` produces normal git refs)
- Collaborative repo where teammates strongly prefer git
- Need for `git worktree` (jj has no equivalent yet)

## References

- Tutorial: https://docs.jj-vcs.dev/latest/tutorial/
- Revsets: https://docs.jj-vcs.dev/latest/revsets/
- Config: https://docs.jj-vcs.dev/latest/config/
- GitHub workflow: https://docs.jj-vcs.dev/latest/github/
- Steve Klabnik tutorial: https://steveklabnik.github.io/jujutsu-tutorial/
