import { TOOL_PREFIX } from './config';
import { runGortex } from './daemon';
import { PUBLIC_TOOLS } from './registry';
import type { PiApi, ToolDescriptor } from './types';

// Single source of truth for which Gortex tools are live this session.
// Doubles as the dedupe guard and the `isGortexTool` check used by the hook.
const registered = new Set<string>();

export function piToolName(bare: string): string {
  return bare.startsWith(TOOL_PREFIX) ? bare : TOOL_PREFIX + bare;
}

export function isGortexTool(name: string): boolean {
  return registered.has(name);
}

// ponytail: the Pi MCP bridge double-stringifies object-typed params (e.g.
// `read`'s `target`). Re-parse stringified object/array fields so
// object-param tools (read/edit/change/refactor/relations/trace) work through
// the bridge. String params that merely look like JSON are left untouched.
export function coerceParams(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params ?? {})) {
    if (typeof v === 'string' && (v.startsWith('{') || v.startsWith('['))) {
      try {
        out[k] = JSON.parse(v);
        continue;
      } catch {
        // not actually JSON — keep as-is
      }
    }
    out[k] = v;
  }
  return out;
}

// Tolerates a redundant registration: a config reload can re-fire
// session_start without resetting the tool registry, in which case the name is
// already live and Pi may throw.
function safeRegister(pi: PiApi, def: unknown): void {
  try {
    pi.registerTool(def);
  } catch {
    // already live this session — existing registration stands.
  }
}

function registerOneTool(pi: PiApi, desc: ToolDescriptor): void {
  const bare = desc.name;
  if (!bare) return;
  const name = piToolName(bare);
  if (registered.has(name)) return;
  registered.add(name);
  safeRegister(pi, {
    name,
    label: name,
    description: desc.description,
    // Pass-through arguments: the model supplies whatever the underlying
    // Gortex tool accepts; `gortex call` validates names + args server side.
    parameters: desc.parameters ?? { type: 'object', additionalProperties: true, properties: {} },
    async execute(_id: string, params: Record<string, unknown>) {
      try {
        const out = runGortex(['call', bare, '--json', JSON.stringify(coerceParams(params ?? {}))]);
        return { content: [{ type: 'text', text: out }], details: {} };
      } catch (err: any) {
        const msg = err?.stderr?.toString?.() || err?.message || String(err);
        throw new Error(`gortex call ${bare} failed: ${msg}`);
      }
    },
  });
}

export function registerGortexTools(pi: PiApi): void {
  registered.clear();
  for (const desc of PUBLIC_TOOLS) registerOneTool(pi, desc);
}
