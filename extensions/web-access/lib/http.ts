import type { AccessConfig } from './config';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

// ponytail: 2 retries with backoff on transient status codes / network resets.
// Add jitter or longer backoff if hitting rate limits.
const TRANSIENT_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit,
  config: AccessConfig
): Promise<T> {
  const maxRetries = 2;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('timeout'), config.timeout);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (response.ok) {
        return (await response.json()) as T;
      }
      if (TRANSIENT_STATUS.has(response.status) && attempt < maxRetries) {
        lastError = new HttpError(response.status, `${response.status} ${response.statusText}`);
        await sleep(200 * (attempt + 1));
        continue;
      }
      throw new HttpError(response.status, `${response.status} ${response.statusText}`);
    } catch (err) {
      if (err instanceof HttpError) throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
      // Timeouts abort cleanly; don't retry what we already gave up on.
      if (lastError.name === 'AbortError' || attempt === maxRetries) throw lastError;
      await sleep(200 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new Error('fetch failed');
}
