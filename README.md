# pi-config

My [pi coding agent](https://github.com/earendil-works/pi) configuration.

## Setup

```bash
git clone git@github.com:smitray/pi-config.git ~/.pi/agent
cd ~/.pi/agent && ./setup.sh
```

Packages auto-install on first pi startup.

## What's inside

| File/Dir | Purpose |
|---|---|
| `settings.json` | Provider, model, theme, packages |
| `models.json` | Custom model definitions (xiaomi, minimax, openrouter) |
| `keybindings.json` | Vim-style keybindings |
| `APPEND_SYSTEM.md` | System prompt augmentation |
| `extensions/` | Custom extensions (`gh`, `guardrails`, `hooks`, `web-access`) |
| `skills/` | User-level pi skills (e.g. `git-commit`) |
| `themes/` | User-level pi themes (e.g. `catppuccin-mocha`) |

## Extensions

| Extension | Description |
|---|---|
| `gh` | GitHub CLI integration — repos, PRs, issues, search, gists, workflows |
| `guardrails` | Security rules blocking risky tool calls |
| `hooks` | Shell hooks on lifecycle events |
| `web-access` | Web search, fetch/crawl, persisted docs, media download |

See [extensions/README.md](extensions/README.md) for dev setup and commands.

## Skills

| Skill | Description |
|---|---|
| `firefox-use` | Playwright Firefox automation — navigate, screenshot, form fill, JS eval |
| `browser-use` | Chrome DevTools Protocol automation via browser-use library |
| `git-commit` | Conventional Commits with emoji prefixes |
| `web-media` | YouTube/media transcription via yt-dlp |
| `web-fetch` | Fetch web pages as clean markdown |
| `web-search` | Web search via SearXNG |
| `om-recall` | Query observational memory from past sessions |

Skills are markdown docs in `skills/*/SKILL.md`. pi auto-discovers them on startup.

## Packages

- `pi-observational-memory` — session continuity
- `pi-ponytail` — lazy-senior-dev mode for the model
