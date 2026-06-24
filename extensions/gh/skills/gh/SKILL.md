---
name: gh
description: >
  GitHub integration via local `gh` CLI. Use for: viewing/creating repositories, pull requests,
  and issues; searching repos/code/issues/PRs; managing gists; listing GitHub Actions workflows
  and runs. Requires `gh` installed and authenticated (`gh auth login`). Mutation operations
  (clone, PR create, issue create, gist create) prompt the user for confirmation.
compatibility: >
  Requires the gh pi extension (installed at ~/.pi/agent/extensions/gh) and the local `gh`
  CLI authenticated against GitHub. For commits with Conventional Commits + emojis, use the
  separate `git-commit` skill (runs git directly, no gh needed).
---

# gh

This skill wraps the 17 tools registered by the `gh` extension. All tools delegate to the
local `gh` CLI — there is no direct GitHub API access.

## Tool quick reference

### Repositories

```text
gh-repo-view owner="facebook" repo="react"
gh-repo-clone owner="facebook" repo="react" dir="~/src/react"
```

`gh-repo-clone` confirms before cloning.

### Pull Requests

```text
gh-pr-list owner="facebook" repo="react" state=open limit=20
gh-pr-list owner="facebook" repo="react" state=merged limit=10
gh-pr-view owner="facebook" repo="react" number=28000
gh-pr-create owner="me" repo="myapp" title="Add login" body="Adds OAuth flow" base=main draft=true
```

`state` = `open` | `closed` | `merged` | `all`. `gh-pr-create` confirms with title + body
preview + base branch + draft flag.

### Issues

```text
gh-issue-list owner="facebook" repo="react" state=open limit=20
gh-issue-view owner="facebook" repo="react" number=1
gh-issue-create owner="me" repo="myapp" title="Bug: dark mode crashes" label=["bug","ux"]
```

`state` = `open` | `closed` | `all`. `gh-issue-create` confirms with title + labels + body
preview.

### Search

```text
gh-search-repos query="language:rust stars:>1000" limit=10
gh-search-code query="repo:vercel/next.js useSWR" limit=10
gh-search-issues query="repo:facebook/react is:open label:bug" limit=20
gh-search-prs query="repo:facebook/react is:open author:me" limit=20
```

All four share the same shape: a `query` string and an optional `limit` (default 10).
`gh-search-code` uses GitHub's code search syntax; the others use GitHub's regular search
syntax with qualifiers like `is:`, `label:`, `author:`, `repo:`, `language:`, `stars:>`.

#### Common search qualifiers

| Qualifier | Example |
|-----------|---------|
| `extension:ts` | `extension:ts import React` |
| `filename:*.json` | `filename:package.json dependencies` |
| `user:username` | `user:nixos programs.vim` |
| `owner:org` | `owner:microsoft extension:ts` |
| `repo:owner/name` | `repo:facebook/react useState` |
| `language:TypeScript` | `language:TypeScript async` |
| `is:open` / `is:closed` | issues + PRs |
| `label:bug` | issues + PRs |
| `author:me` | PRs + issues |
| `stars:>1000` | repos |
| `created:>2025-01-01` | all |

### Gists

```text
gh-gist-list limit=10
gh-gist-view id="abc123def456"
gh-gist-create filename="snippet.ts" content="..." description="..." public=true
```

`gh-gist-create` confirms with filename, public/secret, description, and a 200-char preview
of the content. Content is piped via stdin (not as an arg) so binary / large content works.

### Workflows

```text
gh-workflow-list owner="me" repo="myapp"
gh-run-list owner="me" repo="myapp" workflow="ci.yml" limit=20
```

`workflow` in `gh-run-list` accepts either a workflow file name (`ci.yml`) or a workflow
name. Without it, runs across all workflows are listed.

## Error codes

All tool failures return `isError: true` plus a structured `details.error` code:

| Code | Meaning |
|------|---------|
| `GH_FAILED` | Spawn failed (gh binary missing, ENOENT, etc.) |
| `GH_NONZERO` | gh exited non-zero — see stderr |
| `BLOCKED` | User denied the confirmation prompt |
| `CLONE_FAILED` | `gh repo clone` failed |
| `PR_CREATE_FAILED` | `gh pr create` failed |
| `ISSUE_CREATE_FAILED` | `gh issue create` failed |
| `GIST_CREATE_FAILED` | `gh gist create` failed |

If you get `GH_FAILED` with `ENOENT: gh not found`, install `gh` (`brew install gh`,
`apt install gh`, etc.). If you get `gh: Not authenticated`, run `gh auth login`.

## Patterns

### Pattern: investigate a bug report

```text
gh-issue-view owner="me" repo="myapp" number=42       # read the issue
gh-search-prs query="repo:me/myapp is:closed fix"     # find the fix PR
gh-pr-view owner="me" repo="myapp" number=58           # read the PR
gh-run-list owner="me" repo="myapp" workflow="ci.yml" # check CI status
```

### Pattern: open a PR

1. `gh-pr-list owner="me" repo="myapp" state=open` — see what's already open
2. `gh-pr-create owner="me" repo="myapp" title="…" base=main draft=true` — open as draft
3. After CI passes, ask the user if they want to mark it ready (use `gh pr ready`, not in this
   extension — drop to bash).

### Pattern: cross-repo code search

```text
gh-search-code query="repo:vercel/next.js app router suspense" limit=20
gh-search-code query="org:microsoft useReducer" limit=10
gh-search-code query="language:rust async fn +tokio" limit=20
```

### Pattern: snippet sharing

```text
gh-gist-create filename="regex.txt" content="^(?P<host>[\w.]+):(?P<port>\d+)$" description="URL+port regex" public=true
```

The returned URL is the gist's `https://gist.github.com/<id>`.

## What this extension does NOT do

- **Commits.** Use the separate `git-commit` skill for Conventional Commits with emojis.
  This skill is about GitHub, not git.
- **Push / fetch / pull / merge.** Use the `git` CLI through pi's bash tool.
- **PR review (approve / request changes / merge).** Not in this extension. Drop to bash or
  `gh pr review …` if the user wants those operations.
- **Direct GitHub API calls.** All tools go through `gh`. If `gh` can't do it, this extension
  can't either.

## Safety

Mutation tools prompt the user via `ctx.ui.confirm` before running. The dialog includes
the most relevant fields (title, body preview, base branch, draft flag, labels) so the
user can sanity-check before approving. To skip a confirmation, the user must say "yes" in
the chat — there is no programmatic bypass.
