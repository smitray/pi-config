import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { registerGistTools } from './tools/gist';
import { registerIssueTools } from './tools/issue';
import { registerPRTools } from './tools/pr';
import { registerRepoTools } from './tools/repo';
import { registerSearchTools } from './tools/search';
import { registerWorkflowTools } from './tools/workflow';

const skillsDir = join(dirname(fileURLToPath(import.meta.url)), 'skills');

/**
 * GitHub integration powered by local `gh` CLI.
 *
 * Requirements: `gh` installed + authenticated (`gh auth login`).
 *
 * Tools: repos, PRs, issues, search, gists, workflows.
 */
export default function ghExtension(pi: ExtensionAPI) {
  registerRepoTools(pi);
  registerPRTools(pi);
  registerIssueTools(pi);
  registerSearchTools(pi);
  registerGistTools(pi);
  registerWorkflowTools(pi);

  // Bundle the gh SKILL.md with the extension so it travels with the code.
  pi.on('resources_discover', () => ({ skillPaths: [skillsDir] }));
}
