import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import defaults from './defaults';
import { setupGateHook } from './gate';
import { registerRules } from './guardrails-registry';

interface GuardrailsConfig {
  enabled: boolean;
}

const DEFAULT_CONFIG: GuardrailsConfig = { enabled: true };

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

  // Auto-fix confirmations
  registerRules({
    group: 'auto-fix',
    pattern: '*',
    rules: [
      {
        context: 'command',
        pattern: 'ast-grep * --update-all *',
        action: 'confirm',
        reason: 'ast-grep auto-applies file rewrites — confirm',
      },
      {
        context: 'command',
        pattern: 'ast-grep * -U *',
        action: 'confirm',
        reason: 'ast-grep -U auto-applies rewrites — confirm',
      },
    ],
  });

  // Setup permission gate hook
  setupGateHook(pi, defaults, () => enabled);
}
