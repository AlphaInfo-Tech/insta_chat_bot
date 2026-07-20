export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (err: unknown) => boolean;
}

function defaultShouldRetry(err: unknown): boolean {
  const status = (err as { status?: number; statusCode?: number })?.status
    ?? (err as { status?: number; statusCode?: number })?.statusCode;
  if (status === undefined) return true; // network/timeout errors: retry
  return status >= 500 || status === 429;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Exponential backoff with jitter. Kept deliberately small (default 2
 * retries / 300ms base / 3000ms cap) since this runs inside a Vercel
 * serverless function with a hard execution-time ceiling.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { retries = 2, baseDelayMs = 300, maxDelayMs = 3000, shouldRetry = defaultShouldRetry } = opts;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isLastAttempt = attempt === retries;
      if (isLastAttempt || !shouldRetry(err)) throw err;

      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt) * (0.5 + Math.random() * 0.5);
      await sleep(delay);
    }
  }
  throw lastError;
}
