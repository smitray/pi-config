import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { GORTEX_BIN } from '../config';

// Read-only smoke test against the real `gortex` binary. Proves each tool
// responds and that none emit the [Gortex] read-discipline guard (that guard
// only fires on native Read/Grep/Glob tool calls, never on gortex tools).
// Mutating-only tools (refactor, publish_review, remember) and the
// research-agent-backed `ask` are intentionally excluded.
const SAFE: Record<string, string> = {
  explore: '{"task":"ping"}',
  search: '{"operation":"symbols","query":"x"}',
  read: '{"operation":"source","target":{"symbol":"extensions/gortex/registration.ts::registerGortexTools"}}',
  relations:
    '{"operation":"usages","target":{"symbol":"extensions/gortex/registration.ts::registerGortexTools"}}',
  trace:
    '{"operation":"call_chain","target":{"symbol":"extensions/gortex/registration.ts::registerOneTool"}}',
  analyze: '{"kind":"todos"}',
  change:
    '{"operation":"impact","target":{"symbol":"extensions/gortex/registration.ts::registerOneTool"}}',
  edit: '{"operation":"docs"}',
  review: '{"operation":"questions"}',
  pr: '{"operation":"list"}',
  recall: '{"operation":"memories"}',
  workspace: '{"operation":"repos"}',
  workspace_admin: '{"operation":"coverage"}',
  overlay: '{"operation":"simulate"}',
  session: '{"operation":"agents"}',
  response: '{"operation":"stats"}',
  capabilities: '{"domain":"read"}',
};

function callTool(tool: string, payload: string): { responded: boolean; guarded: boolean } {
  try {
    const out = execFileSync(GORTEX_BIN, ['call', tool, '--json', payload], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      timeout: 30_000,
    });
    return { responded: out.trim().length > 0, guarded: /\[Gortex\]/.test(out) };
  } catch (err: any) {
    const msg = `${err?.stderr ?? ''}${err?.stdout ?? ''}${err?.message ?? ''}`;
    // A gortex-generated response (usage error / note) still proves the tool
    // is live and wired; only a transport failure (binary missing, unknown
    // command) would be a real breakage.
    const responded = /error_code|required argument|unknown .* operation|note:/.test(msg);
    return { responded, guarded: /\[Gortex\]/.test(msg) };
  }
}

describe('gortex binary smoke (read-only ops)', () => {
  for (const [tool, payload] of Object.entries(SAFE)) {
    it(`${tool} responds and emits no [Gortex] guard`, () => {
      const { responded, guarded } = callTool(tool, payload);
      expect(responded).toBe(true);
      expect(guarded).toBe(false);
    }, 30_000);
  }
});
