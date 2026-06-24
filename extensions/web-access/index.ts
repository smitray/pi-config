import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { loadConfig } from './lib/config';
import { clearDocsChunksCache, registerDocsTools } from './tools/docs-tools';
import { registerMediaTools } from './tools/media-cli';
import { clearDocsChunkCache, registerWebFetch } from './tools/web-fetch';
import { registerWebSearch } from './tools/web-search';

const skillsDir = join(dirname(fileURLToPath(import.meta.url)), 'skills');

/**
 * access-web — web search, fetch/crawl, docs persistence, and media download extension.
 *
 * Uses locally hosted SearXNG, Crawl4AI, and yt-dlp.
 * GitHub integration is intentionally left to the existing `gh` extension.
 */
export default function accessWeb(pi: ExtensionAPI): void {
  const config = loadConfig();

  registerWebSearch(pi, config);
  registerWebFetch(pi, config);
  registerMediaTools(pi, config);
  registerDocsTools(pi, config);

  // Bundle our SKILL.md with the extension so it travels with the code.
  pi.on('resources_discover', () => ({ skillPaths: [skillsDir] }));

  // Drop in-memory chunk caches at session end so we don't leak across sessions.
  pi.on('session_shutdown', () => {
    clearDocsChunkCache();
    clearDocsChunksCache();
  });
}
