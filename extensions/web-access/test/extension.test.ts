import { describe, expect, it } from 'vitest';
import accessWeb from '../index';
import { loadConfig } from '../lib/config';

describe('access-web extension', () => {
  it('exports a function', () => {
    expect(typeof accessWeb).toBe('function');
  });

  it('loads default config', () => {
    const saved = { ...process.env };
    delete process.env.PI_SEARXNG_HOST;
    delete process.env.PI_SEARXNG_PORT;
    delete process.env.PI_CRAWL4AI_HOST;
    delete process.env.PI_CRAWL4AI_PORT;
    delete process.env.PI_ACCESS_TIMEOUT;
    try {
      const config = loadConfig();
      expect(config.searxngBase).toBe('http://localhost:8080');
      expect(config.crawl4aiBase).toBe('http://localhost:11234');
      expect(config.timeout).toBe(30000);
    } finally {
      Object.assign(process.env, saved);
    }
  });
});
