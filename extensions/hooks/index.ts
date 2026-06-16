import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { registerCommands } from './commands/register';
import { registerEventHandlers } from './engine/events';
import type { HooksConfig } from './types/schema';

/**
 * Hooks extension — run shell commands on pi lifecycle events.
 *
 * Events: session_start, session_shutdown, tool_call, tool_result, agent_start, agent_end, turn_start, turn_end
 * Commands: /hooks on, /hooks off
 *
 * Tool_call hooks can block execution (exit code 2 or JSON decision: "block").
 *
 * Variable substitution in commands:
 *   %file%  — file path from tool input
 *   %tool%  — tool name
 *   %cwd%   — current working directory
 */
export default function hooksExtension(pi: ExtensionAPI): void {
  let enabled = true;

  const config: HooksConfig = [];

  registerEventHandlers(
    pi,
    () => Promise.resolve(config),
    () => enabled
  );
  registerCommands(pi, {
    get value() {
      return enabled;
    },
    set value(v: boolean) {
      enabled = v;
    },
  });
}
