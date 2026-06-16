# pi-config

My [pi coding agent](https://github.com/earendil-works/pi) configuration.

## Setup

```bash
git clone git@github.com:smitray/pi-config.git ~/.pi/agent
```

Packages auto-install on first pi startup. Extensions dev deps require manual install:

```bash
cd ~/.pi/agent/extensions && npm install
```

## What's inside

| File/Dir | Purpose |
|---|---|
| `settings.json` | Provider, model, theme, packages |
| `models.json` | Custom model definitions (xiaomi, minimax, openrouter) |
| `keybindings.json` | Vim-style keybindings |
| `caveman.json` | Compression config |
| `APPEND_SYSTEM.md` | System prompt augmentation |
| `extensions/` | Custom extensions (gh, guardrails, hooks) |

## Extensions

| Extension | Description |
|---|---|
| `gh` | GitHub CLI integration — repos, PRs, issues, search, gists, workflows |
| `guardrails` | Security rules blocking risky tool calls |
| `hooks` | Shell hooks on lifecycle events |

See [extensions/README.md](extensions/README.md) for dev setup and commands.

## Packages

- `@zosmaai/pi-llm-wiki` — persistent LLM wiki
- `pi-caveman` — token compression
- `pi-observational-memory` — session continuity
