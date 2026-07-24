---
name: gortex
description: >
  Gortex code-intelligence extension for Pi. Use for: localizing tasks, searching the indexed
  graph, reading symbols/summaries, tracing call chains, planning and applying mutations, and
  reviewing changes — all via the gortex_* tools instead of Read/Grep/Glob on indexed source.
  Requires the gortex daemon/binary at /home/debasmitr/.local/bin/gortex.
compatibility: >
  Requires the gortex pi extension (extensions/gortex) and the gortex binary. The extension
  registers 21 gortex_* tools. Native Read/Grep/Glob on indexed source is blocked by the Gortex
  guard — use the gortex_* surface. Related: gortex-guard skill.
---

# gortex

This skill wraps the 21 tools registered by the gortex extension. Each shells
`gortex call <tool> --json <params>` to the local daemon.

## Critical: Use gortex_* tools, NOT native commands

**Never use** `find`, `grep`, `rg`, `bash` with cat/head/tail on indexed source.
Native tools are blocked by the gortex guard. Always use gortex_* tools instead.

## Start here
- `gortex_explore` task="<task>" — localize, get ranked source + call paths. **Always call first.**

## Inspect (never Read/Grep/Glob indexed source)
- `gortex_search` operation="symbols"|"text"|"files" query="..."
- `gortex_read`:
  - whole file: `operation="file"` target={file:"<path>"}  — returns full source
  - one symbol: `operation="source"` target={symbol:"<id>"}
  - summary/dependents: `operation="summary"`
  - pre-edit context only: `operation="editing_context"` (structure, not source)
- `gortex_relations` operation="usages" target={symbol:"<id>"} (callers / implementations)
- `gortex_trace` operation="call_chain"|"flow"|"taint" target={symbol:"<id>"}

### CLI form (only if not using the gortex_read tool)
`gortex call read --arg operation=file --arg 'target:={"file":"<path>"}'`
Pass `key=value` (or `key:=<json>`) per `--arg`. A raw JSON blob as a single
`--arg` is rejected with: `expected key=value or key:=<json>`.

## Mutate (plan then apply)
- `gortex_change` operation="impact" target={symbol:"<id>"} — check blast radius first
- `gortex_edit` / `gortex_refactor` — apply via the daemon; then run change ops
  `detect`, `tests`, `guards`, `contract`
- `gortex_analyze` kind="todos"|"contracts" — find TODOs / contracts

## Review & context
- `gortex_review` / `gortex_pr` — diff + risk context
- `gortex_capabilities` domain="<tool>" — exact operation fields when unsure
- `gortex_workspace` / `gortex_session` / `gortex_response` — state & output control

## Harness note
Object-param tools (read/edit/change/refactor/relations/trace) had a double-stringify bug in
the Pi MCP bridge; the extension's `coerceParams` now re-parses stringified object/array fields.
If you see `target must be an object`, it is a real schema error, not the old bug.

See KB: concepts/gortex-tool-usage-for-pi.
