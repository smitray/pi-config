# Guardrails Extension

Security rules that block or confirm risky tool calls before execution.

## Installation

Auto-discovered from `~/.pi/agent/extensions/guardrails/`. No settings.json entry needed.

## Commands

| Command | Description |
|---------|-------------|
| `/guardrails on` | Enable guardrails |
| `/guardrails off` | Disable guardrails |
| `/guardrails` | Show current status |

## Default Rules

### Dangerous Commands

| Pattern | Action | Reason |
|---------|--------|--------|
| `rm -rf *` | confirm | Recursive delete |
| `sudo rm *` | confirm | Sudo delete |
| `dd *` | confirm | Disk write |
| `mkfs *` | block | Format disk |
| `sudo *` | confirm | Any sudo |

### Interactive Commands

| Pattern | Action | Reason |
|---------|--------|--------|
| `vim *` | block | Use edit tool |
| `nano *` | block | Use edit tool |
| `less *` | block | Use read tool |
| `more *` | block | Use read tool |

### Sensitive Files

| Pattern | Action | Reason |
|---------|--------|--------|
| `.env` | confirm | Environment variables |
| `id_rsa\|id_ed25519\|\.pem$` | block | SSH keys |

## Pattern Syntax

### Command Context (token matching)

| Token | Meaning |
|-------|---------|
| `*` | Zero or more tokens |
| `?` | Exactly one token |
| `{npm,bun}` | One of multiple alternatives |

Examples:
- `npm *` — any npm command
- `{npm,bun} test *` — npm or bun test
- `? run dev *` — any package manager running dev
- `rm -rf *` — recursive delete

### File Context (regex)

Standard regex patterns:
- `\.env$` — files ending in `.env`
- `id_rsa|id_ed25519` — SSH key files
- `secret` — files containing "secret"

## Adding Rules

Edit `defaults.ts`:

```typescript
{
  group: "my-group",
  pattern: "*",
  rules: [
    {
      context: "command",
      pattern: "dangerous-command *",
      action: "block",
      reason: "Blocked because...",
    },
  ],
}
```

## Rule Schema

```typescript
interface GuardrailsRule {
  context: "command" | "file_name" | "file_content";
  pattern: string;
  file_pattern?: string;    // regex to filter files
  includes?: string;        // additional matcher (must match)
  excludes?: string;        // matcher that must NOT match
  scope?: "project" | "external";  // file location restriction
  action: "block" | "confirm";
  reason: string;
}
```

## Architecture

```
guardrails/
├── index.ts       # entry + /guardrails command
├── types.ts       # TypeScript types
├── matcher.ts     # token-based command matching
├── gate.ts        # tool_call hook (block/confirm)
├── defaults.ts    # default rule groups
└── test/          # vitest tests
```

## Testing

```bash
cd ~/.pi/agent/extensions
npx vitest run guardrails
```

## Reference

Based on [knoopx/pi guardrails extension](https://github.com/knoopx/pi/tree/main/agent/extensions/guardrails).
