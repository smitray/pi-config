import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type Message,
  clearConfigCache,
  complete,
  getEmbeddingsConfig,
  getModelConfig,
  getProviderBaseUrl,
  loadKBConfig,
  resolveApiKey,
} from '../lib/models';

beforeEach(() => {
  clearConfigCache();
});

describe('loadKBConfig', () => {
  it('returns defaults when no settings.json exists', () => {
    const config = loadKBConfig();
    expect(config.models.task.id).toBe('mimo-v2.5');
    expect(config.models.synthesis.id).toBe('mimo-v2.5-pro');
    expect(config.models.embedding.id).toBe('nvidia/llama-nemotron-embed-vl-1b-v2:free');
  });

  it('caches config after first load', () => {
    const config1 = loadKBConfig();
    const config2 = loadKBConfig();
    expect(config1).toBe(config2); // same reference
  });
});

describe('getModelConfig', () => {
  it('returns task model config', () => {
    const config = getModelConfig('task');
    expect(config.provider).toBe('mimo-plan');
    expect(config.id).toBe('mimo-v2.5');
  });

  it('returns synthesis model config', () => {
    const config = getModelConfig('synthesis');
    expect(config.provider).toBe('mimo-plan');
    expect(config.id).toBe('mimo-v2.5-pro');
  });

  it('returns embedding model config', () => {
    const config = getModelConfig('embedding');
    expect(config.provider).toBe('curated');
    expect(config.id).toBe('nvidia/llama-nemotron-embed-vl-1b-v2:free');
    expect(config.dimensions).toBe(1024);
  });
});

describe('getEmbeddingsConfig', () => {
  it('returns embeddings config with defaults', () => {
    const config = getEmbeddingsConfig();
    expect(config.enabled).toBe(false);
    expect(config.batchSize).toBe(50);
    expect(config.storePath).toBe('meta/embeddings.json');
  });
});

describe('resolveApiKey', () => {
  it('returns undefined for unknown provider', () => {
    const key = resolveApiKey('unknown-provider');
    expect(key).toBeUndefined();
  });

  it('resolves openrouter key', () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const key = resolveApiKey('openrouter');
    expect(key).toBe('test-key');
    delete process.env.OPENROUTER_API_KEY;
  });

  it('resolves xiaomi key', () => {
    process.env.MIMO_API_KEY = 'test-key';
    const key = resolveApiKey('mimo-plan');
    expect(key).toBe('test-key');
    delete process.env.MIMO_API_KEY;
  });
});

describe('getProviderBaseUrl', () => {
  it('returns curated url', () => {
    expect(getProviderBaseUrl('curated')).toBe('https://openrouter.ai/api/v1');
  });

  it('returns mimo-plan url', () => {
    expect(getProviderBaseUrl('mimo-plan')).toBe('https://token-plan-sgp.xiaomimimo.com/v1');
  });

  it('returns empty string for unknown provider', () => {
    expect(getProviderBaseUrl('unknown')).toBe('');
  });
});

describe('complete', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    clearConfigCache();
  });

  it('sends chat completion and returns content', async () => {
    process.env.MIMO_API_KEY = 'test-complete-key';
    global.fetch = (async (_url: string, _init?: RequestInit) => {
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Hello from test' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      };
    }) as unknown as typeof fetch;

    const config = getModelConfig('task');
    const messages: Message[] = [{ role: 'user', content: 'hi' }];
    const result = await complete(config, messages);

    expect(result.content).toBe('Hello from test');
    expect(result.usage).toEqual({ input: 10, output: 5 });
    delete process.env.MIMO_API_KEY;
  });

  it('throws when no API key is set', async () => {
    // ensure no key is set
    delete process.env.MIMO_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    const config = getModelConfig('task');
    const messages: Message[] = [{ role: 'user', content: 'hi' }];
    await expect(complete(config, messages)).rejects.toThrow('No API key');
  });

  it('handles non-ok response', async () => {
    process.env.MIMO_API_KEY = 'test-error-key';
    global.fetch = (async () => {
      return {
        ok: false,
        status: 500,
        text: async () => 'internal error',
      };
    }) as unknown as typeof fetch;

    const config = getModelConfig('task');
    const messages: Message[] = [{ role: 'user', content: 'hi' }];
    await expect(complete(config, messages)).rejects.toThrow('Completion failed (500)');
    delete process.env.MIMO_API_KEY;
  });
});
