import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { registerGistTools } from './tools/gist';
import { registerIssueTools } from './tools/issue';
import { registerPRTools } from './tools/pr';
import { registerRepoTools } from './tools/repo';
import { registerSearchTools } from './tools/search';
import { registerWorkflowTools } from './tools/workflow';

/**
 * GitHub integration powered by local `gh` CLI.
 *
 * Requirements: `gh` installed + authenticated (`gh auth login`).
 *
 * Tools: repos, PRs, issues, search, gists, workflows
 */
export default function ghExtension(pi: ExtensionAPI) {
  registerRepoTools(pi);
  registerPRTools(pi);
  registerIssueTools(pi);
  registerSearchTools(pi);
  registerGistTools(pi);
  registerWorkflowTools(pi);
}
