import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import defaults from './defaults';
import { setupGateHook } from './gate';

interface GuardrailsConfig {
  enabled: boolean;
}

const DEFAULT_CONFIG: GuardrailsConfig = { enabled: true };

const skillsDir = join(dirname(fileURLToPath(import.meta.url)), 'skills');

/**
 * Guardrails extension — security rules that block or confirm risky tool calls.
 *
 * Commands:
 *   /guardrails on   — enable guardrails
 *   /guardrails off  — disable guardrails
 *
 * Default rules:
 *   - Dangerous commands (rm -rf, sudo, dd, mkfs)
 *   - Interactive commands (vim, nano, less, more)
 *   - Sensitive files (.env, SSH keys)
 */
export default function guardrails(pi: ExtensionAPI) {
  let enabled = DEFAULT_CONFIG.enabled;

  // Register command
  pi.registerCommand('guardrails', {
    description: 'Toggle guardrails with on|off',
    handler: async (args, ctx) => {
      const action = args?.trim().toLowerCase();

      if (action === 'on') {
        enabled = true;
        ctx.ui.notify('Guardrails enabled', 'info');
        return;
      }

      if (action === 'off') {
        enabled = false;
        ctx.ui.notify('Guardrails disabled', 'warning');
        return;
      }

      ctx.ui.notify(`Guardrails: ${enabled ? 'ON' : 'OFF'}`, 'info');
    },
  });

  // Setup permission gate hook
  setupGateHook(pi, defaults, () => enabled);

  // Bundle the guardrails SKILL.md with the extension.
  pi.on('resources_discover', () => ({ skillPaths: [skillsDir] }));
}
