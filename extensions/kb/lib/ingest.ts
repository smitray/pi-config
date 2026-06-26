import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { VaultPaths } from './vault';
import { readJson, writeJson } from './vault';

// ponytail: ingest lists unprocessed sources for the agent to synthesize.
// The agent reads extracted.md and creates wiki pages. Ingest just tracks status.

interface SourcePacket {
  sourceId: string;
  type: string;
  title: string;
  status: 'pending' | 'ingested';
  captured: string;
  extractedPath: string;
}

export function getUningestedSources(paths: VaultPaths): SourcePacket[] {
  if (!existsSync(paths.rawSources)) return [];

  const results: SourcePacket[] = [];
  const dirs = readdirSync(paths.rawSources, { withFileTypes: true });

  for (const d of dirs) {
    if (!d.isDirectory() || !d.name.startsWith('SRC-')) continue;
    const manifestPath = join(paths.rawSources, d.name, 'manifest.json');
    const manifest = readJson<{
      sourceId: string;
      type: string;
      title: string;
      status: string;
      captured: string;
    }>(manifestPath);

    if (!manifest || manifest.status === 'ingested') continue;

    const extractedPath = join(paths.rawSources, d.name, 'extracted.md');
    results.push({
      sourceId: manifest.sourceId,
      type: manifest.type,
      title: manifest.title,
      status: 'pending',
      captured: manifest.captured,
      extractedPath,
    });
  }

  return results;
}

export function markSourceIngested(sourceId: string, paths: VaultPaths): boolean {
  const packetDir = join(paths.rawSources, sourceId);
  const manifestPath = join(packetDir, 'manifest.json');
  const manifest = readJson<{ status: string }>(manifestPath);
  if (!manifest) return false;
  writeJson(manifestPath, { ...manifest, status: 'ingested' });
  return true;
}
