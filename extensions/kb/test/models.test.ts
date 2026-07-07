import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearConfigCache,
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
    expect(getProviderBaseUrl('mimo-plan')).toBe(
      'https://token-plan-sgp.xiaomimimo.com/v1'
    );
  });

  it('returns empty string for unknown provider', () => {
    expect(getProviderBaseUrl('unknown')).toBe('');
  });
});
