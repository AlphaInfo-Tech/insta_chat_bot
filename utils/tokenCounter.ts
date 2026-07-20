/**
 * Lightweight token estimation (~4 chars/token for English, the standard
 * rule-of-thumb for GPT/Llama-family tokenizers) — avoids pulling in a full
 * tokenizer dependency just to enforce soft budgets on prompt sections.
 */
const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Truncates from the end, keeping the beginning of `text` within `maxTokens`. */
export function truncateToTokenBudget(text: string, maxTokens: number): string {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars);
}
