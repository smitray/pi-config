import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { complete, getModelConfig, type Message } from './models';
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

export interface SynthesisResult {
  title: string;
  content: string;
  type: 'source' | 'concept' | 'entity';
  tags: string[];
}

/**
 * AI-powered synthesis: generate wiki page content from source.
 * Returns null if model unavailable or synthesis fails.
 */
export async function synthesizeWithAI(
  source: SourcePacket,
  extractedContent: string
): Promise<SynthesisResult | null> {
  try {
    const config = getModelConfig('task');
    const messages: Message[] = [
      {
        role: 'system',
        content: `You are a knowledge base assistant. Synthesize source material into a wiki page.\n\nReturn JSON with:\n- title: concise page title\n- type: "source" | "concept" | "entity"\n- tags: array of relevant tags\n- content: markdown content with proper headings\n\nRules:\n- Keep it concise but comprehensive\n- Use wiki links [[PageName]] for cross-references\n- Include key facts, decisions, and context\n- Structure with clear headings`,
      },
      {
        role: 'user',
        content: `Source: ${source.title} (${source.type})\n\nContent:\n${extractedContent}`,
      },
    ];

    const result = await complete(config, messages, { maxTokens: 4096 });
    const parsed = JSON.parse(result.content);

    return {
      title: parsed.title ?? source.title,
      content: parsed.content ?? extractedContent,
      type: parsed.type ?? 'source',
      tags: parsed.tags ?? [],
    };
  } catch {
    return null;
  }
}
