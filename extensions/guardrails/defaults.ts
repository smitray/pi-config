import type { GuardrailsGroup } from './types';

const defaults: GuardrailsGroup[] = [
  // Dangerous commands
  {
    group: 'dangerous',
    pattern: '*',
    rules: [
      {
        context: 'command',
        pattern: 'rm -rf *',
        action: 'confirm',
        reason: 'Recursive delete — confirm before running',
      },
      {
        context: 'command',
        pattern: 'sudo rm *',
        action: 'confirm',
        reason: 'Sudo delete — confirm before running',
      },
      {
        context: 'command',
        pattern: 'dd *',
        action: 'confirm',
        reason: 'Disk write command — confirm before running',
      },
      {
        context: 'command',
        pattern: 'mkfs *',
        action: 'block',
        reason: 'Format disk — blocked',
      },
      {
        context: 'command',
        pattern: 'sudo *',
        action: 'confirm',
        reason: 'Sudo command — confirm before running',
      },
    ],
  },
  // Block interactive commands
  {
    group: 'interactive',
    pattern: '*',
    rules: [
      {
        context: 'command',
        pattern: 'vim *',
        action: 'block',
        reason: 'Interactive editor — use edit tool instead',
      },
      {
        context: 'command',
        pattern: 'nano *',
        action: 'block',
        reason: 'Interactive editor — use edit tool instead',
      },
      {
        context: 'command',
        pattern: 'less *',
        action: 'block',
        reason: 'Interactive pager — use read tool instead',
      },
      {
        context: 'command',
        pattern: 'more *',
        action: 'block',
        reason: 'Interactive pager — use read tool instead',
      },
    ],
  },
  // Protect sensitive files
  {
    group: 'sensitive-files',
    pattern: '*',
    rules: [
      {
        context: 'file_name',
        pattern: '\\.env$',
        action: 'confirm',
        reason: 'Editing .env file — confirm',
      },
      {
        context: 'file_name',
        pattern: '\\.env\\.',
        action: 'confirm',
        reason: 'Editing .env.* file — confirm',
      },
      {
        context: 'file_name',
        pattern: 'id_rsa|id_ed25519|\\.pem$',
        action: 'block',
        reason: 'SSH/key file — blocked',
      },
    ],
  },
];

export default defaults;
