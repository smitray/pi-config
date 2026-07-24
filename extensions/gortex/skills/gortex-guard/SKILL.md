---
name: gortex-guard
description: >
  The Gortex read-discipline guard that blocks native Read/Grep/Glob on indexed source and
  redirects to the gortex_* graph tools. Use when a [Gortex] BLOCKED message appears, or to
  understand why grep/read on the agent repo is denied. Fail-open by design.
compatibility: >
  Requires the gortex pi extension with ENFORCE=true (default). Disabled when installed with
  --no-hooks. Related: gortex skill.
---

# gortex-guard

The gortex extension marshals every native `tool_call` to `gortex hook --agent=pi`; the Go
side decides block / allow / soft-nudge.

## Triggers
Native Read / Grep / Glob (and Bash `cat`/`head`/`tail`) on indexed source. You'll see:
- `[Gortex] BLOCKED: Read of <file> (N symbols indexed). Call explore first…`
- `[Gortex] Do not Grep indexed source. Call explore for a task…`
- `[Gortex] BLOCKED: Glob \`<glob>\` targets indexed source…`

The guard fires on **native tool calls only** — `gortex_*` tools never emit it.

## What to do when blocked

**Immediate fix:** Use the correct gortex_* tool:
- `gortex_explore(task="<what to do>")` — find files/symbols first
- `gortex_search(operation="text", query="<text>")` — search text
- `gortex_search(operation="symbols", query="<name>")` — search symbols
- `gortex_read(operation="file", target={file:"<path>"})` — read file

**Prevention:** Always use gortex_* tools for indexed source. Never use find/grep/rg/bash.

## Non-indexed paths
`ls` and non-indexed paths (e.g. ~/.config, /tmp) are fine with native tools.

## Fail-open
Hook errors, timeouts, or daemon-down never block Pi — the decision defaults to allow.

## Where the message lives
Baked into the gortex binary (`/home/debasmitr/.local/bin/gortex`), **not** the TS extension.
Grep the binary's rodata for `Do not Grep indexed source` to find it.

See KB: concepts/gortex-read-discipline-guard.
