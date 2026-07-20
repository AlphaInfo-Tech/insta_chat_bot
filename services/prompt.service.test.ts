import { describe, it, expect } from 'vitest';
import { PromptService } from './prompt.service';
import type { Message } from '@/types/message';

function makeMessage(id: string, role: Message['role'], message: string): Message {
  return {
    id,
    conversationId: 'conv-1',
    role,
    message,
    tokens: null,
    instagramMessageId: null,
    createdAt: new Date().toISOString(),
  };
}

describe('PromptService.buildPrompt', () => {
  it('assembles sections in the required order and returns Groq chat messages', () => {
    const service = new PromptService();
    const result = service.buildPrompt({
      knowledgeContext: 'Refunds take 5 business days.',
      conversationSummary: 'Customer previously asked about shipping.',
      recentMessages: [makeMessage('m1', 'user', 'Hi'), makeMessage('m2', 'assistant', 'Hello!')],
      userQuestion: 'What is your refund policy?',
    });

    const systemIdx = result.fullPrompt.indexOf('You are a helpful customer support assistant');
    const knowledgeIdx = result.fullPrompt.indexOf('Knowledge Context:');
    const summaryIdx = result.fullPrompt.indexOf('Conversation Summary:');
    const recentIdx = result.fullPrompt.indexOf('Recent Messages:');
    const questionIdx = result.fullPrompt.indexOf('Current User Question:');

    expect(systemIdx).toBeGreaterThanOrEqual(0);
    expect(knowledgeIdx).toBeGreaterThan(systemIdx);
    expect(summaryIdx).toBeGreaterThan(knowledgeIdx);
    expect(recentIdx).toBeGreaterThan(summaryIdx);
    expect(questionIdx).toBeGreaterThan(recentIdx);

    expect(result.chatMessages[0]?.role).toBe('system');
    expect(result.chatMessages.at(-1)).toEqual({ role: 'user', content: 'What is your refund policy?' });
  });

  it('omits the Conversation Summary section when there is no summary', () => {
    const service = new PromptService();
    const result = service.buildPrompt({
      knowledgeContext: 'Some context.',
      conversationSummary: null,
      recentMessages: [],
      userQuestion: 'Hi',
    });

    expect(result.fullPrompt).not.toContain('Conversation Summary:');
  });

  it('drops the oldest messages first when history exceeds the token budget', () => {
    const service = new PromptService();
    // Each message is ~250 chars (~63 tokens); default budget is 600 tokens (~9-10 messages fit).
    const messages = Array.from({ length: 20 }, (_, i) =>
      makeMessage(`m${i}`, i % 2 === 0 ? 'user' : 'assistant', `message number ${i} `.repeat(15)),
    );

    const result = service.buildPrompt({
      knowledgeContext: '',
      conversationSummary: null,
      recentMessages: messages,
      userQuestion: 'question',
    });

    expect(result.recentMessages.length).toBeLessThan(messages.length);
    // The kept subset should be a suffix (most recent messages), not a prefix.
    const keptIds = result.recentMessages.map((m) => m.id);
    const lastOriginalId = messages.at(-1)?.id;
    expect(keptIds.at(-1)).toBe(lastOriginalId);
  });
});
