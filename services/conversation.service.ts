import type { ConversationRepository } from '@/repositories/conversation.repository';
import type { MessageRepository } from '@/repositories/message.repository';
import type { GroqClient } from '@/lib/groq';
import type { Conversation } from '@/types/conversation';
import type { Message } from '@/types/message';
import { logger } from '@/utils/logger';

const SUMMARIZATION_THRESHOLD = Number(process.env.SUMMARIZATION_THRESHOLD_MESSAGES ?? 50);
const RECENT_MESSAGE_LIMIT = 10;
const SUMMARY_MODEL = process.env.GROQ_SUMMARY_MODEL ?? process.env.GROQ_MODEL;
const SUMMARY_MAX_TOKENS = 300;

export interface ConversationHistory {
  summary: string | null;
  recentMessages: Message[];
}

export class ConversationService {
  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly messageRepo: MessageRepository,
    private readonly groqClient: GroqClient,
  ) {}

  async getOrCreateActiveConversation(customerId: string): Promise<Conversation> {
    return this.conversationRepo.findOrCreateActive(customerId);
  }

  /**
   * Always the last 10 messages, plus the latest stored summary if one
   * exists (only present once a conversation has crossed the summarization
   * threshold). This is the single place implementing "full history vs.
   * summary + last 10" per the spec.
   */
  async loadHistoryForPrompt(conversationId: string): Promise<ConversationHistory> {
    const [recentMessages, latestSummary] = await Promise.all([
      this.messageRepo.findRecentByConversationId(conversationId, RECENT_MESSAGE_LIMIT),
      this.conversationRepo.getLatestSummary(conversationId),
    ]);

    return { summary: latestSummary?.summary ?? null, recentMessages };
  }

  /**
   * Regenerates the conversation summary when the message count has crossed
   * the threshold and there are messages beyond the last-10 window not yet
   * covered by the existing summary (or no summary exists yet).
   */
  async maybeSummarize(conversation: Conversation): Promise<void> {
    if (conversation.messageCount <= SUMMARIZATION_THRESHOLD) return;

    const latestSummary = await this.conversationRepo.getLatestSummary(conversation.id);
    const coveredUpTo = latestSummary?.messageCountAtSummary ?? 0;
    const uncoveredBeyondRecentWindow = conversation.messageCount - RECENT_MESSAGE_LIMIT - coveredUpTo;

    if (latestSummary && uncoveredBeyondRecentWindow < SUMMARIZATION_THRESHOLD) return;

    const allMessages = await this.messageRepo.findRecentByConversationId(
      conversation.id,
      conversation.messageCount,
    );
    const messagesToSummarize = allMessages.slice(0, Math.max(0, allMessages.length - RECENT_MESSAGE_LIMIT));
    if (messagesToSummarize.length === 0) return;

    const transcript = messagesToSummarize
      .map((m) => `${m.role === 'user' ? 'Customer' : 'Assistant'}: ${m.message}`)
      .join('\n');

    const priorSummarySection = latestSummary
      ? `Previous summary:\n${latestSummary.summary}\n\nNew messages since then:\n${transcript}`
      : `Conversation so far:\n${transcript}`;

    const result = await this.groqClient.createCompletion(
      [
        {
          role: 'system',
          content:
            'Summarize this customer support conversation concisely, preserving names, order details, and unresolved requests. Output the summary only, no preamble.',
        },
        { role: 'user', content: priorSummarySection },
      ],
      { model: SUMMARY_MODEL, maxTokens: SUMMARY_MAX_TOKENS },
    );

    await this.conversationRepo.saveSummary(conversation.id, result.content, conversation.messageCount);
    logger.info('conversation_summarized', {
      conversationId: conversation.id,
      messageCount: conversation.messageCount,
    });
  }
}
