import { describe, it, expect } from 'vitest';
import { truncateForInstagram } from './instagram';

describe('truncateForInstagram', () => {
  it('returns text unchanged when at or under 1000 characters', () => {
    const text = 'a'.repeat(1000);
    expect(truncateForInstagram(text)).toBe(text);
  });

  it('truncates text over 1000 characters down to at most 1000', () => {
    const text = 'word '.repeat(300); // 1500 chars
    const result = truncateForInstagram(text);
    expect(result.length).toBeLessThanOrEqual(1000);
  });

  it('cuts at a word boundary rather than mid-word', () => {
    const text = `${'a'.repeat(990)} verylongwordthatstraddlesthecutoffboundary and more text after that`;
    const result = truncateForInstagram(text);

    expect(result.endsWith('…')).toBe(true);
    const withoutEllipsis = result.slice(0, -1);
    expect(text.startsWith(withoutEllipsis)).toBe(true);
    // The character right after the cut in the original text must be a space (or end of string) —
    // i.e. the cut didn't land in the middle of a word.
    const nextChar = text[withoutEllipsis.length];
    expect(nextChar === ' ' || nextChar === undefined).toBe(true);
  });

  it('ends with an ellipsis when truncated', () => {
    const text = 'x'.repeat(1500);
    expect(truncateForInstagram(text).endsWith('…')).toBe(true);
  });
});
