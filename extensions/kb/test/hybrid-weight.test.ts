import { beforeEach, describe, expect, it } from 'vitest';
import { clearConfigCache, loadKBConfig } from '../lib/models';

beforeEach(() => {
  clearConfigCache();
});

describe('hybridWeight wiring', () => {
  it('defaults to 0.3 from KBRecallConfig', () => {
    const config = loadKBConfig();
    expect(config.recall.hybridWeight).toBe(0.3);
  });

  it('is present in recall config after load', () => {
    // verify the recall config is loaded and wired through
    const config = loadKBConfig();
    expect(config.recall).toBeDefined();
    expect(typeof config.recall.hybridWeight).toBe('number');
    expect(config.recall.hybridWeight).toBeGreaterThan(0);
  });
});
