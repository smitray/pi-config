export interface AccessConfig {
  searxngBase: string;
  crawl4aiBase: string;
  timeout: number;
  maxDepth: number;
  chunkTokens: number;
  maxPages: number;
  crawlConcurrency: number;
  crawlDelayMs: number;
  ytdlpBin: string;
  ytdlpCookies?: string;
  downloadDir: string;
  mediaMaxMb: number;
  whisperApiBase?: string;
  whisperModel?: string;
  tinyfishApiKey?: string;
  tinyfishApiBase: string;
  tinyfishSearchBase: string;
}

function intOrDefault(value: string | undefined, fallback: string): number {
  const parsed = Number.parseInt(value || fallback, 10);
  return Number.isNaN(parsed) ? Number.parseInt(fallback, 10) : parsed;
}

export function loadConfig(): AccessConfig {
  const searxngHost = process.env.PI_SEARXNG_HOST || 'localhost';
  const searxngPort = process.env.PI_SEARXNG_PORT || '8080';
  const crawl4aiHost = process.env.PI_CRAWL4AI_HOST || 'localhost';
  const crawl4aiPort = process.env.PI_CRAWL4AI_PORT || '11234';

  return {
    searxngBase: `http://${searxngHost}:${searxngPort}`,
    crawl4aiBase: `http://${crawl4aiHost}:${crawl4aiPort}`,
    timeout: intOrDefault(process.env.PI_ACCESS_TIMEOUT, '30000'),
    maxDepth: intOrDefault(process.env.PI_ACCESS_MAX_DEPTH, '3'),
    chunkTokens: intOrDefault(process.env.PI_ACCESS_CHUNK_TOKENS, '4000'),
    // ponytail: 50 was too tight for most real wikis; 200 covers large sites
    // while still bounding resource usage. Bump via PI_ACCESS_MAX_PAGES if needed.
    maxPages: intOrDefault(process.env.PI_ACCESS_MAX_PAGES, '200'),
    crawlConcurrency: intOrDefault(process.env.PI_ACCESS_CRAWL_CONCURRENCY, '4'),
    crawlDelayMs: intOrDefault(process.env.PI_ACCESS_CRAWL_DELAY_MS, '200'),
    ytdlpBin: process.env.PI_ACCESS_YTDLP_BIN || 'yt-dlp',
    ytdlpCookies: process.env.PI_ACCESS_YTDLP_COOKIES,
    downloadDir: process.env.PI_ACCESS_DOWNLOAD_DIR || '/tmp/pi-access',
    mediaMaxMb: intOrDefault(process.env.PI_ACCESS_MEDIA_MAX_MB, '100'),
    whisperApiBase: process.env.PI_ACCESS_WHISPER_API || 'http://localhost:7861',
    whisperModel: process.env.PI_ACCESS_WHISPER_MODEL || 'small',
    tinyfishApiKey: process.env.PI_TINYFISH_API_KEY,
    tinyfishApiBase: process.env.PI_TINYFISH_API_BASE || 'https://api.fetch.tinyfish.ai',
    tinyfishSearchBase: process.env.PI_TINYFISH_SEARCH_BASE || 'https://api.search.tinyfish.ai',
  };
}
