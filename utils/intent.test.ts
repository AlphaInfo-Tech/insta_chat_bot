import { describe, it, expect } from 'vitest';
import { detectIntent } from './intent';

describe('detectIntent', () => {
  const cases: Array<[string, string]> = [
    ['hi', 'greeting'],
    ['hello', 'greeting'],
    ['Good morning', 'greeting'],
    ['bye', 'bye'],
    ['goodbye!', 'bye'],
    ['thanks', 'thanks'],
    ['thank you so much', 'thanks'],
    ['ok', 'acknowledgement'],
    ['got it', 'acknowledgement'],
    ['😂😂', 'emoji_only'],
    ['👍', 'emoji_only'],
    ['do you ship to Cairo?', 'business_question'],
    ['I want a refund', 'business_question'],
    ['hi, do you ship to Cairo', 'business_question'],
    ['what are your working hours', 'business_question'],
  ];

  it.each(cases)('classifies %j as %s', (input, expected) => {
    const result = detectIntent(input);
    expect(result.intent).toBe(expected);
  });

  it('returns a non-null cannedResponse for every intent except business_question', () => {
    expect(detectIntent('hi').cannedResponse).not.toBeNull();
    expect(detectIntent('I want a refund').cannedResponse).toBeNull();
  });
});
