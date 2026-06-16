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

## Testing

```bash
cd ~/.pi/agent/extensions
npx vitest run gh
```

## Reference

Based on [knoopx/pi gh extension](https://github.com/knoopx/pi/tree/main/agent/extensions/gh).
