# gh — Features

> GitHub integration powered by the local `gh` CLI.  
> Requirements: `gh` installed + authenticated (`gh auth login`).

## Tools (17)

### Repos (2)

| Tool | Description |
|------|-------------|
| `gh-repo-view` | View repository details (owner/repo) |
| `gh-repo-clone` | Clone a repo to a local directory |

### Pull Requests (3)

| Tool | Description |
| ------ | ------------- |
| `gh-pr-list` | List PRs (state, limit filters) |
| `gh-pr-view` | View PR details by number |
| `gh-pr-create` | Create a PR (title, body, base, draft flag) |

### Issues (3)

| Tool | Description |
| ------ | ------------- |
| `gh-issue-list` | List issues (state, limit filters) |
| `gh-issue-view` | View issue by number |
| `gh-issue-create` | Create issue (title, body, labels) |

### Search (4)

| Tool | Description |
| ------ | ------------- |
| `gh-search-repos` | Search repositories by query |
| `gh-search-code` | Search code across GitHub (GitHub code search syntax) |
| `gh-search-issues` | Search issues by query |
| `gh-search-prs` | Search PRs by query |

### Gists (3)

| Tool | Description |
| ------ | ------------- |
| `gh-gist-list` | List your gists (limit) |
| `gh-gist-view` | View gist by ID |
| `gh-gist-create` | Create gist (filename, content, public flag) |

### Workflows (2)

| Tool | Description |
|------|-------------|
| `gh-workflow-list` | List GitHub Actions workflows for a repo |
| `gh-run-list` | List workflow runs (workflow name, limit) |

## Internal Modules

| File | Purpose |
|------|---------|
| `api/gh.ts` | `gh()` CLI wrapper — runs `gh` via `_shared/spawn`, with `ghRepo()` convenience for `-R owner/repo` |
| `lib/result.ts` | `ok()`/`err()` result helpers — **duplicated** from `_shared/result.ts` |

## Skills

| Skill | Location |
|-------|----------|
| `gh` | `skills/gh/SKILL.md` |

## Mutation Guard

All write operations (clone, PR/issue/gist create) prompt the user for
confirmation before executing.

## Cross-Extension

- Uses `_shared/spawn.ts` for background `gh` CLI execution
- `lib/result.ts` duplicates `_shared/result.ts` instead of importing it
