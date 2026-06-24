---
name: guardrails
description: >
  Security rules that block or confirm risky tool calls before execution. Use for: blocking
  destructive shell commands (rm -rf, mkfs), interactive commands that would hang the agent
  (vim, less), and edits to sensitive files (.env, SSH keys). Built-in `/guardrails on|off`
  command to toggle without editing config.
compatibility: >
  Requires the guardrails pi extension (installed at ~/.pi/agent/extensions/guardrails).
  Customize rules by editing defaults.ts inside the extension — the file is the only source
  of truth and is hot-reloaded on next session.
---

# guardrails

A pre-execution permission gate. Every tool call (except `read` and `genui`) is checked
against a list of rules before it runs. Matching rules either **block** the call outright
or **prompt the user** to confirm.

## Commands

```text
/guardrails on    # enable guardrails
/guardrails off   # disable (also notifies the user with a warning)
/guardrails       # show current status (ON / OFF)
```

When guardrails blocks something, the chat UI shows a warning notification and the tool
call never runs. The model sees the block reason in its next turn and can decide what to
do (explain to the user, try a different approach, etc.).

## Default rules

| Group | Pattern | Action | What it catches |
|-------|---------|--------|-----------------|
| `dangerous` | `rm -rf *` | confirm | Recursive delete |
| `dangerous` | `sudo rm *` | confirm | Sudo delete |
| `dangerous` | `{mkfs,mkfs.*} *` | **block** | Format disk (`mkfs`, `mkfs.ext4`, …) |
| `dangerous` | `dd *` | confirm | Disk write |
| `dangerous` | `sudo *` | confirm | Any sudo |
| `interactive` | `vim *` | **block** | Interactive editor |
| `interactive` | `nano *` | **block** | Interactive editor |
| `interactive` | `less *` | **block** | Interactive pager |
| `interactive` | `more *` | **block** | Interactive pager |
| `sensitive-files` | `\.env$` | confirm | `.env` files |
| `sensitive-files` | `\.env\.` | confirm | `.env.*` files |
| `sensitive-files` | `id_rsa\|id_ed25519\|\.pem$` | **block** | SSH keys + PEM files |

## Pattern syntax

### `context: 'command'` (token-based)

| Token | Meaning |
|-------|---------|
| `*` | Zero or more tokens |
| `?` | Exactly one token |
| `{npm,bun,yarn,pnpm}` | One of multiple literals |

Examples:
- `npm *` — any npm command
- `{npm,bun} test *` — npm or bun test with any subcommand
- `? run dev *` — any package manager running dev
- `rm -rf *` — recursive delete
- `{mkfs,mkfs.*} *` — any mkfs variant followed by anything

Token matching normalizes: strips leading `VAR=value` env assignments (one or many),
strips wrappers like `env`, `nohup`, `time`, `command`, `exec`, and unwraps
`bash -c "..."` / `sh -c '...'` so the inner command is matched.

### `context: 'file_name'` and `context: 'file_content'` (regex)

Standard JS regex:
- `\.env$` — files ending in `.env`
- `id_rsa|id_ed25519` — SSH key files
- `secret` — files containing "secret"

## Rule schema

```ts
interface GuardrailsRule {
  context: 'command' | 'file_name' | 'file_content';
  pattern: string;            // token pattern (command) or regex (file)
  file_pattern?: string;      // regex: only apply if the file matches this first
  includes?: string;          // additional matcher: must also match
  excludes?: string;          // additional matcher: must NOT match
  scope?: 'project' | 'external';  // project = inside cwd; external = outside
  action: 'block' | 'confirm';
  reason: string;
}
```

## Editing rules

The rule list lives in `defaults.ts` inside the extension. Edit and save; the next session
picks up the change.

```ts
// defaults.ts — add a new rule to an existing group
{
  group: 'dangerous',
  pattern: '*',
  rules: [
    // ...existing rules...
    {
      context: 'command',
      pattern: 'chmod -R *',
      action: 'confirm',
      reason: 'Recursive chmod — confirm',
    },
    {
      context: 'file_name',
      pattern: '\\.sql$',
      action: 'confirm',
      reason: 'Touching SQL file',
    },
  ],
}
```

Or add a brand-new group:

```ts
{
  group: 'network',
  pattern: '*',
  rules: [
    {
      context: 'command',
      pattern: 'curl * | bash',
      action: 'block',
      reason: 'Remote script execution — blocked',
    },
  ],
}
```

## Common recipes

### "Always confirm writes to a specific directory"

```ts
{
  context: 'file_name',
  file_pattern: '^/etc/.*',
  action: 'confirm',
  reason: 'Editing /etc/ — confirm',
}
```

### "Confirm deletes, but never block (user can always say yes)"

```ts
{ context: 'command', pattern: 'rm *', action: 'confirm', reason: 'Delete — confirm' }
```

### "Block anything outside the project"

```ts
{
  context: 'file_name',
  pattern: '.*',
  scope: 'external',
  action: 'confirm',
  reason: 'Editing file outside the project — confirm',
}
```

### "Don't run interactive pagers, but allow me to invoke them manually if I really want"

Just put the agent on `/guardrails off` for the session. The agent can suggest the
command; the user runs it in their own shell.

## What guardrails is NOT

- Not a sandbox. Rules are checked, but matching calls still get the chance to confirm.
- Not a substitute for review. Even after `/guardrails on`, the user should read what the
  agent is about to run.
- Not exhaustive. Defaults catch the obvious footguns; add your own rules for your stack.

## Limitations

- Tool call input is matched on string fields (`command`, `path`, `content`). If the tool
  encodes the destructive action in a structured field the rule can't see, it won't fire.
- Confirmation is per-call. If you confirm once, you confirm only that call. The agent can
  try again with a slightly different command.
- Rules don't stack across groups in a meaningful way — first match wins. Order matters.
