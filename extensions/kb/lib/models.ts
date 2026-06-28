import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { VaultPaths } from './vault';

export interface ModelConfig {
  provider: string;
  id: string;
  thinking?: 'low' | 'medium' | 'high';
  maxTokens?: number;
  dimensions?: number;
  fallback?: string;
}

export interface KBModelsConfig {
  task: ModelConfig;
  synthesis: ModelConfig;
  embedding: ModelConfig;
}

export interface EmbeddingsConfig {
  enabled: boolean;
  batchSize: number;
  storePath: string;
}

export interface KBConfig {
  models: KBModelsConfig;
  embeddings: EmbeddingsConfig;
}

// ponytail: cache config at module level, reload on settings.json change
let cachedConfig: KBConfig | null = null;

const DEFAULTS: KBConfig = {
  models: {
    task: {
      provider: 'xiaomi-token-plan-sgp',
      id: 'mimo-v2.5',
      thinking: 'low',
      maxTokens: 4096,
    },
    synthesis: {
      provider: 'xiaomi-token-plan-sgp',
      id: 'mimo-v2.5-pro',
      thinking: 'medium',
      maxTokens: 8192,
    },
    embedding: {
      provider: 'openrouter',
      id: 'nvidia/llama-nemotron-embed-vl-1b-v2:free',
      dimensions: 1024,
      fallback: 'qwen/qwen3-embedding-8b',
    },
  },
  embeddings: {
    enabled: false,
    batchSize: 50,
    storePath: 'meta/embeddings.json',
  },
};

/**
 * Load KB config from settings.json.
 * Returns cached config if available, otherwise reads from disk.
 */
export function loadKBConfig(): KBConfig {
  if (cachedConfig) return cachedConfig;

  const settingsPath = join(homedir(), '.pi', 'agent', 'settings.json');
  if (!existsSync(settingsPath)) {
    cachedConfig = DEFAULTS;
    return cachedConfig;
  }

  try {
    const raw = readFileSync(settingsPath, 'utf-8');
    const settings = JSON.parse(raw);
    const kb = settings.kb ?? {};

    cachedConfig = {
      models: {
        task: { ...DEFAULTS.models.task, ...kb.models?.task },
        synthesis: { ...DEFAULTS.models.synthesis, ...kb.models?.synthesis },
        embedding: { ...DEFAULTS.models.embedding, ...kb.models?.embedding },
      },
      embeddings: {
        ...DEFAULTS.embeddings,
        ...kb.embeddings,
      },
    };

    return cachedConfig;
  } catch {
    cachedConfig = DEFAULTS;
    return cachedConfig;
  }
}

/**
 * Get model config for a specific task type.
 */
export function getModelConfig(taskType: 'task' | 'synthesis' | 'embedding'): ModelConfig {
  const config = loadKBConfig();
  return config.models[taskType];
}

/**
 * Get embeddings config.
 */
export function getEmbeddingsConfig(): EmbeddingsConfig {
  const config = loadKBConfig();
  return config.embeddings;
}

/**
 * Clear config cache (for testing).
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}

/**
 * Resolve API key for a provider.
 * Checks environment variables in order: PROVIDER_API_KEY, OPENROUTER_API_KEY, etc.
 */
export function resolveApiKey(provider: string): string | undefined {
  // Try provider-specific env var first
  const envKey = provider
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+$/, '');
  const specificKey = process.env[`${envKey}_API_KEY`];
  if (specificKey) return specificKey;

  // Fallback to common env vars
  if (provider.includes('openrouter')) return process.env.OPENROUTER_API_KEY;
  if (provider.includes('xiaomi') || provider.includes('mimo')) return process.env.MIMO_API_KEY;
  if (provider.includes('minimax')) return process.env.MINIMAX_API_KEY;

  return undefined;
}

/**
 * Get base URL for a provider.
 */
export function getProviderBaseUrl(provider: string): string {
  const urls: Record<string, string> = {
    'openrouter': 'https://openrouter.ai/api/v1',
    'xiaomi-token-plan-sgp': 'https://token-plan-sgp.xiaomimimo.com/v1',
    'minimax-token-plan': 'https://api.minimax.io/anthropic',
  };
  return urls[provider] ?? '';
}
