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

## Packages

- `pi-observational-memory` — session continuity
- `pi-ponytail` — lazy-senior-dev mode for the model
