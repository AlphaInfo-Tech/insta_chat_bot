import { describe, it, expect } from 'vitest';
import { estimateTokens, truncateToTokenBudget } from './tokenCounter';

describe('tokenCounter', () => {
  it('estimateTokens returns 0 for empty text', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('estimateTokens scales roughly with length (~4 chars/token)', () => {
    expect(estimateTokens('a'.repeat(400))).toBe(100);
  });

  it('truncateToTokenBudget leaves short text untouched', () => {
    const text = 'short text';
    expect(truncateToTokenBudget(text, 100)).toBe(text);
  });

  it('truncateToTokenBudget truncates long text to the char budget', () => {
    const text = 'a'.repeat(1000);
    const truncated = truncateToTokenBudget(text, 10); // 10 tokens * 4 chars = 40 chars
    expect(truncated.length).toBe(40);
  });
});
