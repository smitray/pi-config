---
name: lsp
description: LSP server status and routing. All language servers are managed by mise.
---

# LSP Server Status

Language servers are installed via **mise** (`~/.config/mise/config.toml`) and auto-detected by extension → server mapping.

## Supported Languages

| Extension | Server |
|-----------|--------|
| `.ts`, `.tsx`, `.js`, `.jsx` | typescript-language-server |
| `.vue` | vue-language-server |
| `.svelte` | svelteserver |
| `.py` | pyright-langserver |
| `.go` | gopls |
| `.rs` | rust-analyzer |
| `.lua` | lua-language-server |
| `.yaml`, `.yml` | yaml-language-server |
| `.json` | vscode-json-language-server |
| `.html` | vscode-html-language-server |
| `.css` | vscode-css-language-server |
| `.md` | marksman |
| `Dockerfile` | docker-langserver |

## Tools

- `lsp_check({ path })` — verify server is installed for a file
- `lsp_list({})` — list all configured mappings

## Reinstall

```bash
mise install
```