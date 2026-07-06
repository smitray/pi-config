# hooks — Features

> Shell hooks on pi lifecycle events. Run arbitrary shell commands when
> agent sessions start/end, before/after tool calls, or on agent start.

## Lifecycle Events

| Event | When it fires | Can block? |
|------- | --------------- | ------------ |
| `session_start` | Agent session begins | No (informational) |
| `session_shutdown` | Agent session ends | No (informational) |
| `agent_start` | Agent process starts | No (informational) |
| `tool_call` | Before every tool call | Yes (exit code 2 blocks, JSON `{decision:"block"}` blocks) |
| `tool_result` | After every tool result | No |

## Hook Script Config (`HooksConfig`)

Hooks are configured in code via `HooksConfig`. Each event maps to an array of shell commands:

```typescript
type HooksConfig = {
  session_start?: string[];
  session_shutdown?: string[];
  agent_start?: string[];
  tool_call?: string[];
  tool_result?: string[];
};
```

## Hook Execution (`runHooks`)

| Feature | Detail |
|--------- | -------- |
| Execution | Commands run sequentially per event |
| Timeout | Configurable per command |
| Output | Captured messages shown via `ctx.ui.notify()` |
| Block | `tool_call` hooks can block by exit code 2 or JSON output |
| Errors | Non-blocking events log warnings; blocking events surface to tool pipeline |

## Internal Modules

| File | Purpose |
| ------ | --------- |
| `engine/events.ts` | Registers all lifecycle event handlers — maps pi events to hook execution |
| `engine/hook-execution.ts` | Core `runHooks()` — spawns shell commands, captures output, handles blocking |
| `types/schema.ts` | TypeScript types for hooks configuration |
| `commands/register.ts` | `/hooks on | off` command implementation |

## Commands

| Command | Effect |
|---------|--------|
| `/hooks on` | Enable hooks |
| `/hooks off` | Disable hooks (no config change) |

## Skills

| Skill | Location |
|-------|----------|
| `hooks` | `skills/hooks/SKILL.md` |

## Notes

- Auto-SIGKILL escalation: SIGTERM → 5s grace → SIGKILL (via `_shared/spawn.ts`)
- `notify()` output capped at 5 messages per event to avoid UI flooding on busy sessions
- Config is hardcoded in `index.ts` — no separate file loading (ponytail: empty default, user adds what they need)
