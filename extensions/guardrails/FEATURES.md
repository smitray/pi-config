# guardrails — Features

> Security rules that block or confirm risky tool calls before execution.
> No tools — operates via lifecycle hooks.

## Overview

Guardrails intercepts every tool call and evaluates it against configurable rule groups. Rules can **block** (deny the call) or **confirm** (prompt the user). Ships with sensible defaults for destructive commands and sensitive files.

## Rule Groups

### Default Groups (`defaults.ts`)

| Group | Scope | What it catches |
|------- | ------- | ----------------- |
| **Destructive commands** | `bash` | `rm -rf`, `mkfs`, `dd`, `chmod -R`, `> /dev/sda` |
| **Sensitive files** | `edit`, `write`, `bash` | `.env`, SSH keys, `.gitconfig`, `.netrc`, `id_rsa` |
| **Interactive commands** | `bash` | `vim`, `less`, `more`, `htop`, `nano` — would hang agent |

### Rule Anatomy

Each rule specifies:

| Field | Meaning |
|------- | --------- |
| `context` | `command` (token-based), `file_name`, or `file_content` |
| `pattern` | Token pattern for commands, regex for files |
| `includes` / `excludes` | Precondition patterns |
| `action` | `block` or `confirm` |
| `reason` | Message shown to user when triggered |

Token-pattern syntax: `*` (any), `?` (one), `{a,b,c}` (one-of).

## Internal Modules

| File | Purpose |
| ------ | --------- |
| `matcher.ts` | Token-based command matching — handles `bash -c "..."`, env vars, pipeline segments |
| `gate.ts` | Evaluates rules against tool calls — determines block/confirm/pass |
| `defaults.ts` | 3 default rule groups (editable) |
| `api.ts` | `registerRules()` — lets other extensions (kb) register their own guardrails |
| `types.ts` | Type definitions: `GuardrailsGroup`, `GuardrailsRule`, `RuleAction` |

## Commands

| Command | Effect |
|---------|--------|
| `/guardrails on` | Enable guardrails |
| `/guardrails off` | Disable guardrails (no config change) |

## Skills

| Skill | Location |
|-------|----------|
| `guardrails` | `skills/guardrails/SKILL.md` |

## Cross-Extension

- **kb extension** uses `guardrails/api.ts` to register rules protecting `raw/` and `meta/` directories
- Rule groups are editable in `defaults.ts` — no separate config file needed

## Notes

- Token matcher handles complex bash commands including: `bash -c "..."`, backtick expressions, `$()` subshells, `|` pipelines, and env var prefixes (`FOO=bar cmd`)
- New rules can be added by registering with `api.ts` or extending `defaults.ts`
