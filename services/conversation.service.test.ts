import { describe, it, expect, vi } from 'vitest';
import type { ConversationRepository } from '@/repositories/conversation.repository';
import type { MessageRepository } from '@/repositories/message.repository';
import type { GroqClient } from '@/lib/groq';
import type { Conversation, ConversationSummary } from '@/types/conversation';
import type { Message } from '@/types/message';
import { ConversationService } from './conversation.service';

function makeConversation(messageCount: number): Conversation {
  return {
    id: 'conv-1',
    customerId: 'cust-1',
    status: 'active',
    messageCount,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeMessage(id: string): Message {
  return {
    id,
    conversationId: 'conv-1',
    role: 'user',
    message: `hello ${id}`,
    tokens: null,
    instagramMessageId: null,
    createdAt: new Date().toISOString(),
  };
}

describe('ConversationService.maybeSummarize', () => {
  it('does nothing when message count is under the threshold', async () => {
    const saveSummary = vi.fn();
    const conversationRepo = {
      getLatestSummary: vi.fn(),
      saveSummary,
    } as unknown as ConversationRepository;
    const messageRepo = { findRecentByConversationId: vi.fn() } as unknown as MessageRepository;
    const groqClient = { createCompletion: vi.fn() } as unknown as GroqClient;

    const service = new ConversationService(conversationRepo, messageRepo, groqClient);
    await service.maybeSummarize(makeConversation(10));

    expect(saveSummary).not.toHaveBeenCalled();
    expect(groqClient.createCompletion).not.toHaveBeenCalled();
  });

  it('summarizes via Groq and persists when over the threshold with no existing summary', async () => {
    const messages = Array.from({ length: 55 }, (_, i) => makeMessage(`m${i}`));
    const conversationRepo = {
      getLatestSummary: vi.fn().mockResolvedValue(null),
      saveSummary: vi.fn().mockResolvedValue({} as ConversationSummary),
    } as unknown as ConversationRepository;
    const messageRepo = {
      findRecentByConversationId: vi.fn().mockResolvedValue(messages),
    } as unknown as MessageRepository;
    const groqClient = {
      createCompletion: vi.fn().mockResolvedValue({
        content: 'Summary text',
        promptTokens: 100,
        completionTokens: 20,
        latencyMs: 50,
        model: 'llama-3.3-70b-versatile',
      }),
    } as unknown as GroqClient;

    const service = new ConversationService(conversationRepo, messageRepo, groqClient);
    await service.maybeSummarize(makeConversation(55));

    expect(groqClient.createCompletion).toHaveBeenCalledTimes(1);
    expect(conversationRepo.saveSummary).toHaveBeenCalledWith('conv-1', 'Summary text', 55);
  });

  it('does not re-summarize when the existing summary already covers recent messages', async () => {
    const existingSummary: ConversationSummary = {
      id: 'sum-1',
      conversationId: 'conv-1',
      summary: 'prior summary',
      messageCountAtSummary: 54, // count(55) - recentWindow(10) - covered(54) < threshold(50)
      createdAt: new Date().toISOString(),
    };
    const conversationRepo = {
      getLatestSummary: vi.fn().mockResolvedValue(existingSummary),
      saveSummary: vi.fn(),
    } as unknown as ConversationRepository;
    const messageRepo = { findRecentByConversationId: vi.fn() } as unknown as MessageRepository;
    const groqClient = { createCompletion: vi.fn() } as unknown as GroqClient;

    const service = new ConversationService(conversationRepo, messageRepo, groqClient);
    await service.maybeSummarize(makeConversation(55));

    expect(groqClient.createCompletion).not.toHaveBeenCalled();
    expect(conversationRepo.saveSummary).not.toHaveBeenCalled();
  });
});
