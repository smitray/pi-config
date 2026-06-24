import { describe, expect, it } from 'vitest';
import accessWeb from '../index';
import { loadConfig } from '../lib/config';

describe('access-web extension', () => {
  it('exports a function', () => {
    expect(typeof accessWeb).toBe('function');
  });

  it('loads default config', () => {
    const config = loadConfig();
    expect(config.searxngBase).toBe('http://localhost:8080');
    expect(config.crawl4aiBase).toBe('http://localhost:11234');
    expect(config.timeout).toBe(30000);
  });
});
