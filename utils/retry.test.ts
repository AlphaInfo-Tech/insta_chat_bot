import { describe, it, expect, vi } from 'vitest';
import { withRetry } from './retry';

describe('withRetry', () => {
  it('returns the result on first success without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { retries: 2, baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and eventually succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce('ok');

    const result = await withRetry(fn, { retries: 2, baseDelayMs: 1 });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting all retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));

    await expect(withRetry(fn, { retries: 2, baseDelayMs: 1 })).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3); // initial attempt + 2 retries
  });

  it('does not retry when shouldRetry returns false', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('bad request'));

    await expect(
      withRetry(fn, { retries: 2, baseDelayMs: 1, shouldRetry: () => false }),
    ).rejects.toThrow('bad request');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
