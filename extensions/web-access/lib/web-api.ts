import type { AccessConfig } from './config';
import { loadConfig } from './config';
import { fetchJson } from './http';
import { approxTokens, extractTitle } from './markdown';
import type { SearchHit } from './types';

export interface WebSearchResult {
  query: string;
  source: 'searxng' | 'tinyfish';
  results: SearchHit[];
}

export interface WebFetchResult {
  url: string;
  title: string;
  markdown: string;
  source: 'crawl4ai' | 'tinyfish';
  tokens: number;
}

export interface WebSearchOptions {
  limit?: number;
  language?: string;
  time_range?: string;
  engine?: string;
  category?: string;
}

export interface WebFetchOptions {
  f?: 'fit' | 'raw' | 'bm25' | 'llm' | 'clean';
  q?: string;
}

/**
 * Search the web. Defaults to SearXNG; falls back to TinyFish (tf_search)
 * if PI_TINYFISH_API_KEY is set and SearXNG is unreachable.
 */
export async function webSearch(
  query: string,
  options: WebSearchOptions = {}
): Promise<WebSearchResult> {
  const config = loadConfig();
  const n = options.limit ?? 5;

  if (config.tinyfishApiKey) {
    try {
      const hits = await tfSearch(query, n, config);
      return { query, source: 'tinyfish', results: hits };
    } catch {
      // fall through to searxng
    }
  }

  const hits = await searxngSearch(query, n, options.language, options.time_range, config);
  return { query, source: 'searxng', results: hits };
}

/**
 * Fetch a URL as markdown. Defaults to Crawl4AI; uses TinyFish (tf_fetch)
 * for the clean (tf) strategy when PI_TINYFISH_API_KEY is set.
 */
export async function webFetch(
  url: string,
  options: WebFetchOptions = {}
): Promise<WebFetchResult> {
  const config = loadConfig();
  const filter = options.f ?? 'fit';

  if (filter === 'clean' && config.tinyfishApiKey) {
    const { tfFetch } = await import('./clean-fetch');
    const result = await tfFetch(url, config);
    return {
      url: result.url,
      title: result.title,
      markdown: result.markdown,
      source: 'tinyfish',
      tokens: result.tokens,
    };
  }

  const data = await fetchJson<{ url?: string; markdown?: string; success?: boolean; error?: string }>(
    `${config.crawl4aiBase}/md`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url, q: options.q ?? '', f: filter }),
    },
    config
  );

  if (!data.success || !data.markdown) {
    throw new Error(data.error || `Crawl4AI fetch failed for ${url}`);
  }

  const title = extractTitle(data.markdown);
  const tokens = approxTokens(data.markdown);
  return {
    url: data.url || url,
    title,
    markdown: data.markdown,
    source: 'crawl4ai',
    tokens,
  };
}

// --- search helpers (exported for tool layer) ---

export async function tfSearch(
  query: string,
  limit: number,
  config: AccessConfig
): Promise<SearchHit[]> {
  const params = new URLSearchParams({ query, limit: String(limit) });
  const url = `${config.tinyfishSearchBase}?${params}`;
  const data = await fetchJson<{ results?: Array<{ title?: string; url?: string; snippet?: string }>; error?: { message?: string } }>(
    url,
    { headers: { 'X-API-Key': config.tinyfishApiKey ?? '' } },
    config
  );
  if (data.error) throw new Error(data.error.message || 'TinyFish search error');
  return (data.results || []).slice(0, limit).map((r) => ({
    title: r.title || r.url || '',
    url: r.url || '',
    snippet: r.snippet || '',
  }));
}

export async function searxngSearch(
  query: string,
  limit: number,
  language: string | undefined,
  time_range: string | undefined,
  config: AccessConfig
): Promise<SearchHit[]> {
  const params: Record<string, string> = { q: query, format: 'json' };
  if (language) params.language = language;
  if (time_range) params.time_range = time_range;
  const searchUrl = `${config.searxngBase}/search?${new URLSearchParams(params)}`;
  const data = await fetchJson<{ results?: Array<{ title?: string; url?: string; content?: string }> }>(
    searchUrl,
    {},
    config
  );
  return (data.results || []).slice(0, limit).map((r) => ({
    title: r.title || r.url || '',
    url: r.url || '',
    snippet: r.content || '',
  }));
}

