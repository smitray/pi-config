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
| `models.json` | Curated OpenRouter model list (qwen, openai, gemma, glm, ...) |
| `keybindings.json` | Vim-style keybindings |
| `APPEND_SYSTEM.md` | System prompt augmentation (caveman + ponytail modes) |
| `extensions/` | Custom extensions (`gh`, `guardrails`, `hooks`, `kb`, `markitdown`, `web-access`) |
| `skills/` | User-level pi skills (`git-commit`, `om-recall`) |
| `themes/` | User-level pi themes (`catppuccin-mocha`) |

## Extensions

| Extension | Description |
|---|---|
| `gh` | GitHub CLI integration — repos, PRs, issues, search, gists, workflows |
| `guardrails` | Security rules blocking risky tool calls |
| `hooks` | Shell hooks on lifecycle events |
| `kb` | Knowledge Base — persistent wiki vaults with type-enforced templates |
| `markitdown` | Microsoft MarkItDown — PDF/DOCX/PPTX/XLSX/images → Markdown |
| `web-access` | Web search (SearXNG), fetch/crawl (Crawl4AI), docs persistence, media (yt-dlp) |

See [extensions/README.md](extensions/README.md) for dev setup and commands.

## Skills

| Skill | Description |
|---|---|
| `git-commit` | Conventional Commits with emoji prefixes |
| `om-recall` | Query observational memory from past sessions |

Web search/fetch/media tools are bundled inside the `web-access` extension (not standalone skills). Skills are markdown docs in `skills/*/SKILL.md`. pi auto-discovers them on startup.

## Packages

- `pi-observational-memory` — session continuity via observations/reflections