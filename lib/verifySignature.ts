import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifies Meta's X-Hub-Signature-256 header (HMAC-SHA256 of the raw request
 * body, keyed by the app secret). Must be called with the raw body text
 * BEFORE JSON.parse, since the signature is computed over the exact bytes
 * Meta sent.
 */
export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader) return false;

  const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signatureHeader);

  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
