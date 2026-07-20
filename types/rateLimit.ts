export interface RateLimitRecord {
  id: string;
  rateKey: string;
  windowStart: string;
  requestCount: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  windowStart: string;
  limit: number;
}
