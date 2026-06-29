# GitHub Extension

GitHub integration powered by the local `gh` CLI.

## Requirements

- `gh` CLI installed: [cli.github.com](https://cli.github.com/)
- Authenticated: `gh auth login`

## Installation

Auto-discovered from `~/.pi/agent/extensions/gh/`. No settings.json entry needed.

## Tools

### Repositories

| Tool | Description | Parameters |
|------|-------------|------------|
| `gh-repo-view` | View repository info | `owner`, `repo` |
| `gh-repo-clone` | Clone repository | `owner`, `repo`, `dir?` |

### Pull Requests

| Tool | Description | Parameters |
|------|-------------|------------|
| `gh-pr-list` | List PRs | `owner`, `repo`, `state?`, `limit?` |
| `gh-pr-view` | View a PR | `owner`, `repo`, `number` |
| `gh-pr-create` | Create PR | `owner`, `repo`, `title`, `body?`, `base?`, `draft?` |

### Issues

| Tool | Description | Parameters |
|------|-------------|------------|
| `gh-issue-list` | List issues | `owner`, `repo`, `state?`, `limit?` |
| `gh-issue-view` | View an issue | `owner`, `repo`, `number` |
| `gh-issue-create` | Create issue | `owner`, `repo`, `title`, `body?`, `label?` |

### Search

| Tool | Description | Parameters |
|------|-------------|------------|
| `gh-search-repos` | Search repositories | `query`, `limit?` |
| `gh-search-code` | Search code | `query`, `limit?` |
| `gh-search-issues` | Search issues | `query`, `limit?` |
| `gh-search-prs` | Search PRs | `query`, `limit?` |

### Gists

| Tool | Description | Parameters |
|------|-------------|------------|
| `gh-gist-list` | List your gists | `limit?` |
| `gh-gist-view` | View a gist | `id` |
| `gh-gist-create` | Create gist | `filename`, `content`, `description?`, `public?` |

### Workflows

| Tool | Description | Parameters |
|------|-------------|------------|
| `gh-workflow-list` | List workflows | `owner`, `repo` |
| `gh-run-list` | List workflow runs | `owner`, `repo`, `workflow?`, `limit?` |

## Search Query Syntax

GitHub code search qualifiers:

| Qualifier | Example |
|-----------|---------|
| `extension:ts` | `extension:ts import React` |
| `filename:*.json` | `filename:package.json dependencies` |
| `user:username` | `user:nixos programs.vim` |
| `owner:org` | `owner:microsoft extension:ts` |
| `repo:owner/name` | `repo:facebook/react useState` |
| `language:TypeScript` | `language:TypeScript async` |

## Safety

Mutation operations prompt for confirmation:
- `gh-pr-create` — confirms before creating PR
- `gh-issue-create` — confirms before creating issue
- `gh-gist-create` — confirms before creating gist
- `gh-repo-clone` — confirms before cloning

## Architecture

```
gh/
├── api/gh.ts        # gh CLI wrapper (execSync)
├── tools/
│   ├── repo.ts      # gh-repo-view, gh-repo-clone
│   ├── pr.ts        # gh-pr-list, gh-pr-view, gh-pr-create
│   ├── issue.ts     # gh-issue-list, gh-issue-view, gh-issue-create
│   ├── search.ts    # gh-search-repos/code/issues/prs
│   ├── gist.ts      # gh-gist-list, gh-gist-view, gh-gist-create
│   └── workflow.ts  # gh-workflow-list, gh-run-list
├── index.ts
└── test/
```

## Examples

### View a repository

```bash
gh-repo-view owner=earendil-works repo=pi
gh-repo-view owner=facebook repo=react
```

### Clone a repository

```bash
gh-repo-clone owner=earendil-works repo=pi dir=~/workspace/pi
```

### List and view PRs

```bash
# List open PRs
gh-pr-list owner=smitray repo=pi-config state=open limit=10

# List merged PRs
gh-pr-list owner=smitray repo=pi-config state=merged limit=5

# View a specific PR
gh-pr-view owner=smitray repo=pi-config number=3
```

### Create a PR

```bash
gh-pr-create owner=smitray repo=pi-config title="feat(kb): add new tools" body="Adds 5 new tools" base=main
gh-pr-create owner=smitray repo=pi-config title="fix: bug" base=main draft=true
```

### Manage issues

```bash
# List issues
gh-issue-list owner=smitray repo=pi-config state=open limit=20

# View an issue
gh-issue-view owner=smitray repo=pi-config number=42

# Create an issue
gh-issue-create owner=smitray repo=pi-config title="Add pagination" body="Need pagination for large repos" label=["enhancement"]
```

### Search GitHub

```bash
# Search repositories
gh-search-repos query="pinia vue3" limit=5

# Search code
gh-search-code query="useCounterStore extension:ts" limit=10
gh-search-code query="import React from 'react'" limit=5

# Search issues
gh-search-issues query="bug label:priority" limit=10

# Search PRs
gh-search-prs query="is:merged author:nixos" limit=5
```

### Gists

```bash
# List your gists
gh-gist-list limit=20

# View a gist
gh-gist-view id=abc123

# Create a public gist
gh-gist-create filename=example.ts content="export const x = 1" description="Example snippet" public=true

# Create a private gist
gh-gist-create filename=secret.ts content="const key = 'xxx'" public=false
```

### Workflows and CI

```bash
# List workflows
gh-workflow-list owner=smitray repo=pi-config

# List recent runs
gh-run-list owner=smitray repo=pi-config limit=10

# List runs for a specific workflow
gh-run-list owner=smitray repo=pi-config workflow=ci.yml limit=5
```

## Testing

```bash
cd ~/.pi/agent/extensions
npx vitest run gh
```

## Reference

Based on [knoopx/pi gh extension](https://github.com/knoopx/pi/tree/main/agent/extensions/gh).
