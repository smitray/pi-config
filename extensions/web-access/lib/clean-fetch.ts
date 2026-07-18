import type { AccessConfig } from './config';
import { fetchJson } from './http';
import { approxTokens, extractTitle } from './markdown';

// ponytail: three-tier clean fetch — TinyFish API first, Crawl4AI fit fallback.
// TinyFish returns ~1.2k tokens vs Crawl4AI's ~12k for the same page (~90% reduction).
// No LLM extraction tier — that would burn more tokens than it saves unless
// the extraction LLM is cheaper than the downstream LLM.

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
 * Fetch a URL and return clean markdown with minimal tokens.
 *
 * Tier 1: TinyFish Fetch API (if configured) — ~90% token reduction
 * Tier 2: Crawl4AI fit mode (always available) — basic content extraction
 *
 * ponytail: no LLM extraction tier because token savings don't justify the
 * extraction cost. Add if downstream LLM costs are high enough.
 */
export async function cleanFetch(url: string, config: AccessConfig): Promise<CleanFetchResult> {
  // Tier 1: TinyFish
  if (config.tinyfishApiKey) {
    try {
      const data = await fetchJson<TinyFishFetchResponse>(
        `${config.tinyfishApiBase}/v1/fetch`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.tinyfishApiKey}`,
          },
          body: JSON.stringify({ urls: [url] }),
        },
        config
      );

      const result = data.results?.[0];
      if (result?.text && !data.errors?.length) {
        const tokens = approxTokens(result.text);
        return {
          url: result.url || url,
          markdown: result.text,
          title: result.title || extractTitle(result.text),
          source: 'tinyfish',
          tokens,
        };
      }
      // ponytail: TinyFish failed (rate limit, auth, etc) — fall through to Crawl4AI
    } catch {
      // ponytail: network error on TinyFish — fall through to Crawl4AI
    }
  }

  // Tier 2: Crawl4AI fit mode
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
