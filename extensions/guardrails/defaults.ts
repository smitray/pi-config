import type { GuardrailsGroup } from './types';

/**
 * Default guardrails. Edit this file to customize.
 *
 * Each group has a name (`group`), an optional pattern that scopes the group
 * to certain tools (use `*` to match every tool), and a list of rules.
 *
 * Rule shape:
 *   {
 *     context: 'command' | 'file_name' | 'file_content',
 *     pattern: <token pattern for command, regex otherwise>,
 *     file_pattern?: <regex>    // only match rules whose file matches this first
 *     includes?: <pattern>      // rule only applies if this also matches
 *     excludes?: <pattern>      // rule skipped if this matches
 *     scope?: 'project' | 'external',
 *     action: 'block' | 'confirm',
 *     reason: string,
 *   }
 *
 * Token-pattern syntax (for `context: 'command'`):
 *   *            zero or more tokens
 *   ?            exactly one token
 *   {a,b,c}      one of the listed literals
 *
 * Add a new rule under an existing group, or create a new group entirely.
 */

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
        pattern: '{mkfs,mkfs.*} *',
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
  // Block commands that expose environment variables
  {
    group: 'sensitive-commands',
    pattern: '*',
    rules: [
      {
        context: 'command',
        pattern: 'printenv',
        action: 'block',
        reason: 'Exposes environment variables — blocked',
      },
      {
        context: 'command',
        pattern: 'printenv *',
        action: 'block',
        reason: 'Exposes environment variables — blocked',
      },
      {
        context: 'command',
        pattern: 'env',
        action: 'block',
        reason: 'Exposes environment variables — blocked',
      },
    ],
  },
];

export default defaults;
