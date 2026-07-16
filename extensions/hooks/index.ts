import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { registerCommands } from './commands/register';
import { loadConfig } from './engine/config';
import { registerEventHandlers } from './engine/events';

const skillsDir = join(dirname(fileURLToPath(import.meta.url)), 'skills');

/**
 * Hooks extension — run shell commands on pi lifecycle events.
 *
 * Events: session_start, session_shutdown, agent_start, tool_call, tool_result
 * Commands: /hooks on, /hooks off
 *
 * tool_call hooks can block execution (exit code 2 or JSON decision: "block").
 *
 * Variable substitution in commands:
 *   %file%    — file path from tool input (edit/write/read/find/grep/etc.)
 *   %command% — bash command string (for tool_name=bash)
 *   %tool%    — tool name
 *   %cwd%     — current working directory
 *
 * Config file: `hooks.json` in the hooks extension directory.
 * Create it with a HooksGroup[] array. Restart the session to pick up changes.
 * If no hooks.json exists, no hooks run (empty config).
 */
export default function hooksExtension(pi: ExtensionAPI): void {
  let enabled = true;

  // Load hooks from hooks.json, falling back to empty config.
  const config = loadConfig();

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

  pi.on('resources_discover', () => ({ skillPaths: [skillsDir] }));
}
