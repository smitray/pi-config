import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { isToolCallEventType } from '@earendil-works/pi-coding-agent';
import { getVaultPaths, resolveVaultContext } from './vault';

// ponytail: guardrail resolves vault path per-event (not at load time).
// Fixes the bug where guardrail pointed to startup-cwd vault instead of
// the actual active vault when cwd changes between sessions/projects.

export function installGuardrails(pi: ExtensionAPI): void {
  pi.on('tool_call', async (event, _ctx) => {
    if (
      !(
        (event.toolName === 'write' && isToolCallEventType('write', event)) ||
        (event.toolName === 'edit' && isToolCallEventType('edit', event))
      )
    ) {
      return;
    }

    const cwd = _ctx.cwd ?? process.cwd();
    const { root } = resolveVaultContext(cwd);
    const paths = getVaultPaths(root);
    const dotKb = paths.dotKb;

    const targetPath = 'path' in event.input ? (event.input as { path: string }).path : '';

    if (targetPath.includes(`${dotKb}/raw`) || targetPath.includes(`${dotKb}/meta`)) {
      return {
        block: true,
        reason: `kb: ${dotKb}/raw/ and ${dotKb}/meta/ are immutable. Edit pages in wiki/ instead.`,
      };
    }
  });
}
