import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';

/**
 * Shared admin-route auth check. Timing-safe comparison mirrors
 * verifyMetaSignature's length-check-then-timingSafeEqual pattern so a
 * leaked/guessed key can't be brute-forced via response-time differences.
 */
export function isAuthorized(req: NextRequest): boolean {
  const configured = process.env.ADMIN_API_KEY;
  if (!configured) return false;

  const provided = req.headers.get('x-admin-api-key') ?? '';
  const configuredBuf = Buffer.from(configured);
  const providedBuf = Buffer.from(provided);

  if (configuredBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(configuredBuf, providedBuf);
}
