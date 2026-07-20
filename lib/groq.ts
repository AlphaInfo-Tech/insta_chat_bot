import Groq from 'groq-sdk';
import { withRetry } from '@/utils/retry';
import { logger } from '@/utils/logger';
import type { GroqChatMessage, GroqCompletionOptions, GroqCompletionResult } from '@/types/groq';

const DEFAULT_MODEL = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
const DEFAULT_MAX_TOKENS = Number(process.env.ANSWER_MAX_TOKENS ?? 250);

let cachedClient: Groq | null = null;

function getClient(): Groq {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY must be set');

  cachedClient = new Groq({ apiKey });
  return cachedClient;
}

export class GroqClient {
  async createCompletion(
    messages: GroqChatMessage[],
    options: GroqCompletionOptions = {},
  ): Promise<GroqCompletionResult> {
    const model = options.model ?? DEFAULT_MODEL;
    const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    const start = Date.now();

    const completion = await withRetry(() =>
      getClient().chat.completions.create({
        model,
        messages,
        max_tokens: maxTokens,
        temperature: options.temperature ?? 0.3,
      }),
    );

    const latencyMs = Date.now() - start;
    const content = completion.choices[0]?.message?.content ?? '';
    const promptTokens = completion.usage?.prompt_tokens ?? 0;
    const completionTokens = completion.usage?.completion_tokens ?? 0;

    logger.info('groq_completion', { model, latencyMs, promptTokens, completionTokens });

    return { content, promptTokens, completionTokens, latencyMs, model };
  }
}
