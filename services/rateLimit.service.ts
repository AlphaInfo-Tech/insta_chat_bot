import type { RateLimitRepository } from '@/repositories/rateLimit.repository';
import type { RateLimitCheckResult } from '@/types/rateLimit';

const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 10);
const WINDOW_SECONDS = Number(process.env.RATE_LIMIT_WINDOW_SECONDS ?? 60);

export class RateLimitService {
  constructor(private readonly rateLimitRepo: RateLimitRepository) {}

  async checkAndIncrement(senderId: string): Promise<RateLimitCheckResult> {
    const rateKey = `ig:${senderId}`;
    const windowMs = WINDOW_SECONDS * 1000;
    const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();

    const record = await this.rateLimitRepo.incrementAndGet(rateKey, windowStart);

    return {
      allowed: record.requestCount <= MAX_REQUESTS,
      remaining: Math.max(0, MAX_REQUESTS - record.requestCount),
      windowStart,
      limit: MAX_REQUESTS,
    };
  }
}
