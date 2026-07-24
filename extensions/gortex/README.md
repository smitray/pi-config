# gortex

Gortex extension for the Pi coding agent. Pi has no MCP transport by design, so this
extension (a) exposes Gortex's public tools as native `gortex_*` Pi tools, and (b) recreates
the Claude-Code "prefer graph tools over raw file reads" enforcement via the `gortex hook`
binary.

## What it does

1. **Tool mirror** — on every `session_start` it brings up the shared Gortex daemon and
   registers the fixed 21-tool public roster under a `gortex_` prefix (collision-avoidance).
   Each tool shells `gortex call <bare> --json <params>` to the daemon.
2. **Read-discipline enforcement** — every native `tool_call` (Read/Grep/Glob/Bash on indexed
   source) is marshalled into a normalized envelope and handed to `gortex hook --agent=pi`.
   The Go side decides block / allow / soft-nudge. **Fail-open**: hook errors never block Pi.

## Layout

Split into small, single-responsibility modules (was a single `index.ts`):

| File | Responsibility |
|------|----------------|
| `types.ts` | Shared types (`PiDecision`, `ToolDescriptor`, `PiApi`) |
| `config.ts` | Runtime config resolved at load: `GORTEX_BIN` (via XDG_BIN_HOME → `~/.local/bin` → `PATH`), `HOOK_ARGV`, `ENFORCE`, `TOOL_PREFIX`, `GORTEX_INSTRUCTIONS` |
| `registry.ts` | `PUBLIC_TOOLS` — the closed 21-tool roster |
| `daemon.ts` | `runGortex` (exec) + `ensureDaemon` (spawn, fire-and-forget) |
| `registration.ts` | `piToolName`, `coerceParams`, `registerGortexTools`, `isGortexTool` |
| `hook.ts` | `normalizeToolCall` (Pi→Claude-Code vocab) + `callHook` |
| `index.ts` | Entry: wires `session_start` / `before_agent_start` / `context` / `tool_call` |

Zero runtime dependencies — Node built-ins only.

## Adding a tool

Append one entry to `PUBLIC_TOOLS` in `registry.ts`:

```ts
{ name: 'explore', description: 'Localize a task and return ranked source plus call paths. Call first.' },
```

The bare name is the exact public CLI/MCP name; the `gortex_` prefix is added automatically at
registration. No other change needed.

## Harness double-stringify fix

The Pi MCP bridge double-stringifies object-typed params (e.g. `read`'s `target`), which made
object-param tools (`read`/`edit`/`change`/`refactor`/`relations`/`trace`) fail with
`target must be an object`. `coerceParams` in `registration.ts` re-parses any stringified
object/array field before the `--json` payload is built, recovering the original structure.
Plain strings that only *look* like JSON are left untouched.

## Guard behavior

The `[Gortex] …` messages are emitted by the `gortex` binary (resolved at runtime via
`XDG_BIN_HOME` → `~/.local/bin` → `PATH`; default `/home/debasmitr/.local/bin/gortex`), **not**
this TypeScript — they live in the binary's rodata. Enforcement is toggled by `ENFORCE`; installing with `--no-hooks` disables it while
keeping the graph tools. The guard fires on native Read/Grep/Glob only; `gortex_*` tools never
trigger it.

## Tests

```bash
npm test -- gortex          # runs all gortex tests
npm run test:coverage       # with coverage
```

- `test/normalize.test.ts` — `normalizeToolCall` (Pi→Claude-Code vocab map)
- `test/hook.test.ts` — `callHook` parse + fail-open
- `test/daemon.test.ts` — `runGortex` trim + `ensureDaemon` never throws
- `test/registration.test.ts` — prefix, dedupe, `coerceParams`, execute payload
- `test/smoke.test.ts` — read-only smoke against the real `gortex` binary; asserts every tool
  responds and none emit the `[Gortex]` guard

## Skills

- `skills/gortex/SKILL.md` — tool usage (when to use each, harness note)
- `skills/gortex-guard/SKILL.md` — the read-discipline guard (triggers, what to do, fail-open)

Knowledge backing these skills is captured in the project KB
(`concepts/gortex-tool-usage-for-pi`, `concepts/gortex-read-discipline-guard`).
