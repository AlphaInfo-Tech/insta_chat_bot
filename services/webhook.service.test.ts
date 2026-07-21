import { describe, it, expect, vi } from 'vitest';
import type { CustomerService } from './customer.service';
import type { ConversationService } from './conversation.service';
import type { MessageService } from './message.service';
import type { RagService } from './rag.service';
import type { PromptService } from './prompt.service';
import type { SettingsService } from './settings.service';
import type { WebhookEventRepository } from '@/repositories/webhookEvent.repository';
import type { GroqClient } from '@/lib/groq';
import type { InstagramClient } from '@/lib/instagram';
import type { InstagramMessagingEvent } from '@/types/webhookEvents';
import type { Customer } from '@/types/customer';
import type { Conversation } from '@/types/conversation';
import { WebhookService } from './webhook.service';
import { DEFAULT_SETTINGS } from '@/types/settings';

const CUSTOMER: Customer = { id: 'cust-1', instagramId: 'ig-1', username: null, createdAt: '' };
const CONVERSATION: Conversation = {
  id: 'conv-1',
  customerId: 'cust-1',
  status: 'active',
  messageCount: 3,
  createdAt: '',
  updatedAt: '',
};

function buildDeps(overrides: {
  markProcessed?: boolean;
  createCompletion?: { content: string; completionTokens: number };
} = {}) {
  const customerService = { getOrCreateCustomer: vi.fn().mockResolvedValue(CUSTOMER) } as unknown as CustomerService;
  const conversationService = {
    getOrCreateActiveConversation: vi.fn().mockResolvedValue({ ...CONVERSATION }),
    maybeSummarize: vi.fn().mockResolvedValue(undefined),
    loadHistoryForPrompt: vi.fn().mockResolvedValue({ summary: null, recentMessages: [] }),
  } as unknown as ConversationService;
  const messageService = {
    saveUserMessage: vi.fn().mockResolvedValue({}),
    saveAssistantMessage: vi.fn().mockResolvedValue({}),
  } as unknown as MessageService;
  const ragService = {
    retrieveContext: vi.fn().mockResolvedValue({ docs: [], contextText: '', tokenCount: 0 }),
  } as unknown as RagService;
  const promptService = {
    buildPrompt: vi.fn().mockReturnValue({ chatMessages: [{ role: 'user', content: 'q' }] }),
  } as unknown as PromptService;
  const webhookEventRepo = {
    markProcessed: vi.fn().mockResolvedValue(overrides.markProcessed ?? true),
  } as unknown as WebhookEventRepository;
  const groqClient = {
    createCompletion: vi.fn().mockResolvedValue({
      content: overrides.createCompletion?.content ?? 'The refund policy is 30 days.',
      completionTokens: overrides.createCompletion?.completionTokens ?? 42,
      promptTokens: 100,
      latencyMs: 10,
      model: 'llama-3.3-70b-versatile',
    }),
  } as unknown as GroqClient;
  const instagramClient = { sendMessage: vi.fn().mockResolvedValue(undefined) } as unknown as InstagramClient;
  const settingsService = {
    getSettings: vi.fn().mockResolvedValue(DEFAULT_SETTINGS),
  } as unknown as SettingsService;

  const service = new WebhookService(
    customerService,
    conversationService,
    messageService,
    ragService,
    promptService,
    webhookEventRepo,
    groqClient,
    instagramClient,
    settingsService,
  );

  return {
    service,
    customerService,
    conversationService,
    messageService,
    ragService,
    groqClient,
    instagramClient,
    webhookEventRepo,
    settingsService,
  };
}

function baseEvent(overrides: Partial<InstagramMessagingEvent> = {}): InstagramMessagingEvent {
  return {
    sender: { id: 'ig-1' },
    recipient: { id: 'page-1' },
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('WebhookService.handleIncomingMessage', () => {
  it('skips echo messages entirely', async () => {
    const { service, customerService } = buildDeps();
    await service.handleIncomingMessage(baseEvent({ message: { mid: 'm1', text: 'hi', is_echo: true } }));
    expect(customerService.getOrCreateCustomer).not.toHaveBeenCalled();
  });

  it('skips duplicate deliveries', async () => {
    const { service, customerService } = buildDeps({ markProcessed: false });
    await service.handleIncomingMessage(baseEvent({ message: { mid: 'm1', text: 'hi' } }));
    expect(customerService.getOrCreateCustomer).not.toHaveBeenCalled();
  });

  it('ignores a bare reaction with no message', async () => {
    const { service, customerService } = buildDeps();
    await service.handleIncomingMessage(baseEvent({ reaction: { reaction: 'love', action: 'react' } }));
    expect(customerService.getOrCreateCustomer).not.toHaveBeenCalled();
  });

  it('sends a canned reply for attachment-only messages without calling Groq', async () => {
    const { service, messageService, groqClient, instagramClient } = buildDeps();
    await service.handleIncomingMessage(
      baseEvent({ message: { mid: 'm1', attachments: [{ type: 'image', payload: {} }] } }),
    );

    expect(groqClient.createCompletion).not.toHaveBeenCalled();
    expect(messageService.saveAssistantMessage).toHaveBeenCalled();
    expect(instagramClient.sendMessage).toHaveBeenCalledWith('ig-1', expect.stringContaining('text messages'), 'page-1');
  });

  it('sends a canned reply for greetings without calling Groq/RAG', async () => {
    const { service, ragService, groqClient, instagramClient } = buildDeps();
    await service.handleIncomingMessage(baseEvent({ message: { mid: 'm1', text: 'hi' } }));

    expect(ragService.retrieveContext).not.toHaveBeenCalled();
    expect(groqClient.createCompletion).not.toHaveBeenCalled();
    expect(instagramClient.sendMessage).toHaveBeenCalledWith('ig-1', expect.any(String), 'page-1');
  });

  it('runs the full RAG + Groq flow for business questions and replies via Instagram', async () => {
    const { service, ragService, groqClient, instagramClient, messageService } = buildDeps();
    await service.handleIncomingMessage(baseEvent({ message: { mid: 'm1', text: 'What is your refund policy?' } }));

    expect(ragService.retrieveContext).toHaveBeenCalledWith(
      'What is your refund policy?',
      DEFAULT_SETTINGS.knowledgeContextMaxTokens,
    );
    expect(groqClient.createCompletion).toHaveBeenCalledTimes(1);
    expect(messageService.saveAssistantMessage).toHaveBeenCalledWith('conv-1', 'The refund policy is 30 days.', 42);
    expect(instagramClient.sendMessage).toHaveBeenCalledWith('ig-1', 'The refund policy is 30 days.', 'page-1');
  });

  it('falls back to the canned unavailable-answer text when Groq fails', async () => {
    const { service, messageService, groqClient } = buildDeps();
    (groqClient.createCompletion as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('groq down'));

    await service.handleIncomingMessage(baseEvent({ message: { mid: 'm1', text: 'What is your refund policy?' } }));

    expect(messageService.saveAssistantMessage).toHaveBeenCalledWith(
      'conv-1',
      DEFAULT_SETTINGS.fallbackAnswer,
      0,
    );
  });
});
