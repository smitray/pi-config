import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface ModelConfig {
  provider: string;
  id: string;
  thinking?: 'low' | 'medium' | 'high';
  maxTokens?: number;
  dimensions?: number;
  fallback?: string;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  signal?: AbortSignal;
  maxTokens?: number;
  temperature?: number;
}

export interface CompletionResult {
  content: string;
  usage?: { input: number; output: number };
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

export interface KBLintConfig {
  staleDays: number;
  warnOnOrphans: boolean;
}

export interface KBRecallConfig {
  // ponytail: hybridWeight reserved for future embeddings wiring — no consumer yet.
  hybridWeight: number;
}

export interface KBConfig {
  models: KBModelsConfig;
  embeddings: EmbeddingsConfig;
  recall: KBRecallConfig;
  autoIngest: boolean;
  autoLint: boolean;
  lint: KBLintConfig;
}

// ponytail: cache config at module level, reload on settings.json change
let cachedConfig: KBConfig | null = null;

const DEFAULTS: KBConfig = {
  models: {
    task: {
      provider: 'mimo-plan',
      id: 'mimo-v2.5',
      thinking: 'low',
      maxTokens: 4096,
    },
    synthesis: {
      provider: 'mimo-plan',
      id: 'mimo-v2.5-pro',
      thinking: 'medium',
      maxTokens: 8192,
    },
    embedding: {
      provider: 'curated',
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
  recall: {
    hybridWeight: 0.3,
  },
  autoIngest: true,
  autoLint: true,
  lint: {
    staleDays: 30,
    warnOnOrphans: true,
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
      recall: {
        ...DEFAULTS.recall,
        ...kb.recall,
      },
      autoIngest: kb.autoIngest ?? DEFAULTS.autoIngest,
      autoLint: kb.autoLint ?? DEFAULTS.autoLint,
      lint: {
        ...DEFAULTS.lint,
        ...kb.lint,
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
    curated: 'https://openrouter.ai/api/v1',
    'mimo-plan': 'https://token-plan-sgp.xiaomimimo.com/v1',
    minimax: 'https://api.minimax.io/v1',
  };
  return urls[provider] ?? '';
}

// ─── API Client ────────────────────────────────────────────────

// ponytail: simple retry with exponential backoff for transient errors
async function fetchWithRetry(url: string, init: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, init);
    if (res.status !== 429 && res.status < 500) return res;
    if (i < retries - 1) {
      const delay = 2 ** i * 1000;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  // Final attempt returns whatever we got
  return fetch(url, init);
}

/**
 * Send chat completion request (OpenAI-compatible).
 */
export async function complete(
  config: ModelConfig,
  messages: Message[],
  options?: CompletionOptions
): Promise<CompletionResult> {
  const baseUrl = getProviderBaseUrl(config.provider);
  const apiKey = resolveApiKey(config.provider);

  if (!apiKey) {
    throw new Error(`No API key found for provider: ${config.provider}`);
  }

  const body = {
    model: config.id,
    messages,
    max_tokens: options?.maxTokens ?? config.maxTokens ?? 4096,
    temperature: options?.temperature,
  };

  const res = await fetchWithRetry(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'unknown error');
    throw new Error(`Completion failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
  };

  return {
    content: data.choices[0]?.message?.content ?? '',
    usage: data.usage
      ? { input: data.usage.prompt_tokens, output: data.usage.completion_tokens }
      : undefined,
  };
}

/**
 * Generate embeddings (OpenAI-compatible).
 * ponytail: removed — dead code, never called. Re-add when embeddings pipeline is wired.
 */
