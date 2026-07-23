import type { AccessConfig } from './config';
import { fetchJson } from './http';
import { approxTokens, extractTitle } from './markdown';

interface TinyFishFetchResult {
  url?: string;
  title?: string;
  format?: string;
  text?: string;
}

interface TinyFishFetchResponse {
  results?: TinyFishFetchResult[];
  errors?: Array<{ url?: string; error?: string }>;
}

interface Crawl4AiResponse {
  url?: string;
  markdown?: string;
  success?: boolean;
  error?: string;
}

export interface CleanFetchResult {
  url: string;
  markdown: string;
  title: string;
  source: 'tinyfish' | 'crawl4ai';
  tokens: number;
}

/**
 * Fetch a URL via Crawl4AI fit mode (default local backend).
 */
export async function cleanFetch(url: string, config: AccessConfig): Promise<CleanFetchResult> {
  const crawlUrl = `${config.crawl4aiBase}/md`;
  const crawlBody = JSON.stringify({ url, f: 'fit' });

  const data = await fetchJson<Crawl4AiResponse>(
    crawlUrl,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: crawlBody,
    },
    config
  );

  if (!data.success || !data.markdown) {
    throw new Error(data.error || `Crawl4AI returned failure for ${url}`);
  }

  const tokens = approxTokens(data.markdown);
  return {
    url: data.url || url,
    markdown: data.markdown,
    title: extractTitle(data.markdown),
    source: 'crawl4ai',
    tokens,
  };
}

/**
 * Fetch a URL via TinyFish Fetch API (opt-in, cleaner output, ~90% fewer tokens).
 * Requires PI_TINYFISH_API_KEY.
 */
export async function tinyfishFetch(url: string, config: AccessConfig): Promise<CleanFetchResult> {
  if (!config.tinyfishApiKey) {
    throw new Error('TinyFish API key not configured. Set PI_TINYFISH_API_KEY.');
  }

  const data = await fetchJson<TinyFishFetchResponse>(
    `${config.tinyfishApiBase}/v1/fetch`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.tinyfishApiKey,
      },
      body: JSON.stringify({ urls: [url] }),
    },
    config
  );

  const result = data.results?.[0];
  if (!result?.text || data.errors?.length) {
    throw new Error(data.errors?.[0]?.error || 'TinyFish fetch failed');
  }

  const tokens = approxTokens(result.text);
  return {
    url: result.url || url,
    markdown: result.text,
    title: result.title || extractTitle(result.text),
    source: 'tinyfish',
    tokens,
  };
}
