import type { ExtensionCommandContext } from '@earendil-works/pi-coding-agent';

export function registerCommands(
  pi: {
    registerCommand: (
      name: string,
      opts: {
        description: string;
        handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
      }
    ) => void;
  },
  ref: { value: boolean }
): void {
  pi.registerCommand('hooks', {
    description: 'Toggle hooks with on|off',
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const action = args?.trim().toLowerCase();

      if (action === 'on') {
        ref.value = true;
        ctx.ui?.notify('Hooks enabled', 'info');
        return;
      }

      if (action === 'off') {
        ref.value = false;
        ctx.ui?.notify('Hooks disabled', 'warning');
        return;
      }

      ctx.ui?.notify(`Hooks: ${ref.value ? 'ON' : 'OFF'}`, 'info');
    },
  });
}
