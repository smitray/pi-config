# Hooks Extension

Run shell commands on pi lifecycle events.

## Installation

Auto-discovered from `~/.pi/agent/extensions/hooks/`. No settings.json entry needed.

## Commands

| Command | Description |
|---------|-------------|
| `/hooks on` | Enable hooks |
| `/hooks off` | Disable hooks |
| `/hooks` | Show current status |

## Events

| Event | Trigger |
|-------|---------|
| `session_start` | Session begins |
| `session_shutdown` | Session ends |
| `agent_start` | Agent starts |
| `agent_end` | Agent ends |
| `turn_start` | Turn begins |
| `turn_end` | Turn ends |
| `tool_call` | Before tool execution (can block) |
| `tool_result` | After tool execution |

## Tool Call Blocking

Only `tool_call` hooks can block execution:
- Exit code `2` → blocks the tool call
- JSON output with `decision: "block"` → blocks

## Variable Substitution

Use these variables in hook commands:

| Variable | Replaced With |
|----------|---------------|
| `%file%` | File path from tool input |
| `%tool%` | Tool name |
| `%cwd%` | Current working directory |

## Hook Input/Output

### Input (JSON on stdin)

```json
{
  "cwd": "/path/to/project",
  "hook_event_name": "tool_call",
  "tool_name": "bash",
  "tool_input": { "command": "npm test" },
  "tool_call_id": "call_123"
}
```

### Output (JSON on stdout)

```json
{
  "decision": "block",
  "reason": "Not allowed",
  "systemMessage": "Hook message"
}
```

## Rule Schema

```json
[
  {
    "group": "typescript",
    "pattern": "{tsconfig.json,tsconfig.*.json}",
    "hooks": [
      {
        "event": "tool_result",
        "context": "file_name",
        "pattern": "\\.(ts|tsx)$",
        "command": "bun run typecheck 2>&1 | { grep \"%file%\" || true; }",
        "timeout": 60000,
        "notify": true
      }
    ]
  }
]
```

### Hook Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `event` | string | ✓ | Event to trigger on |
| `command` | string | ✓ | Shell command to run |
| `context` | string | | `tool_name`, `file_name`, or `command` |
| `pattern` | string | | Regex pattern to match |
| `cwd` | string | | Working directory |
| `timeout` | number | | Timeout in ms (default: 10000) |
| `notify` | boolean | | Show system message |

## Pattern Matching

### `tool_name` / `file_name`

Standard regex: `\.(ts|tsx)$`, `secret`, `config`

### `command`

Token matching (same as guardrails):
- `*` — zero or more tokens
- `?` — exactly one token
- `{npm,bun}` — alternatives

## Examples

### Check status

```bash
/hooks on      # enable
/hooks off     # disable
/hooks         # show status
```

### Auto-typecheck on TypeScript save

```json
[
  {
    "group": "typescript",
    "pattern": "*",
    "hooks": [
      {
        "event": "tool_result",
        "context": "file_name",
        "pattern": "\\.(ts|tsx)$",
        "command": "npm run typecheck 2>&1 | head -20",
        "timeout": 60000,
        "notify": true
      }
    ]
  }
]
```

### Block dangerous commands

```json
[
  {
    "group": "safety",
    "pattern": "*",
    "hooks": [
      {
        "event": "tool_call",
        "context": "command",
        "pattern": "rm -rf / *",
        "command": "echo '{\"decision\":\"block\",\"reason\":\"Recursive root delete\"}'"
      }
    ]
  }
]
```

### Run tests after git commit

```json
[
  {
    "group": "ci",
    "pattern": "*",
    "hooks": [
      {
        "event": "tool_result",
        "context": "command",
        "pattern": "git commit *",
        "command": "npm test",
        "timeout": 120000,
        "notify": true
      }
    ]
  }
]
```

## Architecture

```
hooks/
├── types/schema.ts        # TypeScript types
├── engine/
│   ├── hook-execution.ts  # runHooks(), variable substitution
│   └── events.ts          # event handler registration
├── commands/register.ts   # /hooks on|off
├── index.ts
└── test/
```

## Testing

```bash
cd ~/.pi/agent/extensions
npx vitest run hooks
```

## Reference

Based on [knoopx/pi hooks extension](https://github.com/knoopx/pi/tree/main/agent/extensions/hooks).
