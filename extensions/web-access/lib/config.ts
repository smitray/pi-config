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
  whisperBin?: string;
  whisperModel?: string;
  whisperCuda: boolean;
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
    maxPages: intOrDefault(process.env.PI_ACCESS_MAX_PAGES, '50'),
    crawlConcurrency: intOrDefault(process.env.PI_ACCESS_CRAWL_CONCURRENCY, '4'),
    crawlDelayMs: intOrDefault(process.env.PI_ACCESS_CRAWL_DELAY_MS, '200'),
    ytdlpBin: process.env.PI_ACCESS_YTDLP_BIN || 'yt-dlp',
    ytdlpCookies: process.env.PI_ACCESS_YTDLP_COOKIES,
    downloadDir: process.env.PI_ACCESS_DOWNLOAD_DIR || '/tmp/pi-access',
    mediaMaxMb: intOrDefault(process.env.PI_ACCESS_MEDIA_MAX_MB, '100'),
    whisperBin: process.env.PI_ACCESS_WHISPER_BIN,
    whisperModel: process.env.PI_ACCESS_WHISPER_MODEL,
    whisperCuda: process.env.PI_ACCESS_WHISPER_CUDA === '1',
  };
}
