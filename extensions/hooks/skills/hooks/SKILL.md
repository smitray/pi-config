---
name: hooks
description: >
  Run shell commands on pi lifecycle events. Use for: session start/shutdown logging,
  typechecking on save (tool_result for *.ts files), pre-tool-call blocking (refuse destructive
  bash commands), CI lint hooks, audit logging. Hooks can block tool calls via exit code 2 or
  JSON `{"decision":"block"}`. Toggle with `/hooks on|off` — no code change needed.
compatibility: >
  Requires the hooks pi extension (installed at ~/.pi/agent/extensions/hooks). Edit the
  `config` array in `index.ts` to add hooks; restart the session to pick up changes.
---

# hooks

The hooks extension runs shell commands in response to pi lifecycle events. The
config lives in `index.ts` as a `HooksConfig` array — edit it, save, restart.

## Commands

```text
/hooks on
/hooks off
/hooks                # show status
```

`/hooks off` disables hook execution without losing the config — turn it back on with
`/hooks on`.

## Events

| Event | When | Can block? |
|-------|------|-----------|
| `session_start` | Session begins (startup, reload, new, resume, fork) | no |
| `session_shutdown` | Session ends (quit, reload, replace) | no |
| `agent_start` | An agent loop starts | no |
| `tool_call` | Before every tool executes | **yes** |
| `tool_result` | After every tool completes | no |

(`agent_end`, `turn_start`, `turn_end` are valid pi events but not registered here. Add
them when you actually need them.)

## Variable substitution

Variables in `command` strings are replaced before execution:

| Variable | Replaced with | Notes |
|----------|---------------|-------|
| `%file%` | Tool input's `path` field | Empty for bash |
| `%command%` | Tool input's `command` field | For bash invocations |
| `%tool%` | Tool name (`bash`, `edit`, `read`, …) | |
| `%cwd%` | Current working directory | |

`%file%` and `%command%` are now separate: a `bash` invocation has no `%file%`, and
`edit`/`write`/`read` have no `%command%`. This avoids the previous ambiguity where
bash commands were leaked as file paths.

## Output protocol

The hook command's stdout, if valid JSON, is parsed as a `HookOutput`:

```json
{
  "decision": "block",
  "reason": "Not allowed",
  "systemMessage": "Sent to the user as a UI notification"
}
```

If the JSON has `decision: "block"`, the tool call is blocked.

Exit codes:

| Exit | Meaning |
|------|---------|
| `0` | OK — parse stdout as JSON if present, ignore otherwise |
| `2` | Block (Claude Code convention) — stderr becomes the reason |
| anything else | Treated as failure — no block, no notification |

Anything written to stderr is shown to the user if the call is blocked; otherwise it's
invisible.

## Rule schema

```ts
interface HookRule {
  event: HookEvent;
  context?: 'tool_name' | 'file_name' | 'command';
  pattern?: string;     // regex for context
  command: string;      // shell command to run; variables substituted
  cwd?: string;         // override working directory
  timeout?: number;     // ms before SIGTERM (default 10_000)
  notify?: boolean;     // surface systemMessage to the UI (default false)
}
```

## Examples

### Session-end log

```ts
{
  group: 'shutdown',
  pattern: '*',
  hooks: [
    {
      event: 'session_shutdown',
      command: "echo 'pi session ended at' $(date) >> ~/.pi/agent/.session-log",
      timeout: 5000,
    },
  ],
}
```

### Typecheck on .ts save

```ts
{
  group: 'tsc',
  pattern: '*',
  hooks: [
    {
      event: 'tool_result',
      context: 'file_name',
      pattern: '\\.(ts|tsx)$',
      command: 'bun run typecheck 2>&1 | grep -E "%file%|error" | head -20',
      timeout: 60_000,
      notify: true,
    },
  ],
}
```

### Block destructive bash

```ts
{
  group: 'safety',
  pattern: '*',
  hooks: [
    {
      event: 'tool_call',
      context: 'command',
      pattern: '^rm -rf /($|\\s)',
      command:
        "printf '%s' '{\"decision\":\"block\",\"reason\":\"Refusing to rm -rf /\"}'",
    },
  ],
}
```

### Require review for force pushes

```ts
{
  group: 'git',
  pattern: '*',
  hooks: [
    {
      event: 'tool_call',
      context: 'command',
      pattern: 'git push.*--force',
      command:
        "printf '%s' '{\"decision\":\"block\",\"reason\":\"Use --force-with-lease instead\"}'",
    },
  ],
}
```

### Lint-staged style formatting on .ts save

```ts
{
  group: 'fmt',
  pattern: '*',
  hooks: [
    {
      event: 'tool_result',
      context: 'file_name',
      pattern: '\\.(ts|tsx|js|jsx)$',
      command: 'npx prettier --write "%file%" 2>&1',
      timeout: 15_000,
    },
  ],
}
```

## Hook configuration is in `index.ts`

The config is currently hard-coded in `index.ts` as a `const config: HooksConfig = [...]`
array. To add hooks, edit that array and restart the session. Future enhancement: load
from `${cwd}/.pi/hooks.json` if present and merge with the defaults. (Skipped per YAGNI
until someone actually wants per-project config.)

## What hooks are NOT

- Not a CI runner. Use `gh-run-list` + actual CI for that.
- Not a sandbox. Hooks block or confirm but don't restrict the underlying execution.
- Not multi-process. Each hook runs sequentially in its own shell. Hooks don't
  communicate with each other.

## Failure modes

- Hook command not found → silently no-op (the loop continues, no block, no message).
- Hook timeout → SIGTERM after `timeout` ms, SIGKILL 5s later. If still running, treat
  as failure.
- Hook emits invalid JSON to stdout → stdout is ignored, hook counts as success.
- Hook error → surface a warning via `ctx.ui.notify("Hook error (...)", "warning")` so
  you notice next session.
