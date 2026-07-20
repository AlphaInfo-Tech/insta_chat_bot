import type { CustomerService } from '@/services/customer.service';
import type { ConversationService } from '@/services/conversation.service';
import type { MessageService } from '@/services/message.service';
import type { RagService } from '@/services/rag.service';
import type { PromptService } from '@/services/prompt.service';
import type { WebhookEventRepository } from '@/repositories/webhookEvent.repository';
import type { GroqClient } from '@/lib/groq';
import type { InstagramClient } from '@/lib/instagram';
import type { InstagramMessagingEvent } from '@/types/webhookEvents';
import { detectIntent, getAttachmentCannedResponse } from '@/utils/intent';
import { FALLBACK_ANSWER } from '@/prompts/systemPrompt';
import { logger } from '@/utils/logger';

const ANSWER_MAX_TOKENS = Number(process.env.ANSWER_MAX_TOKENS ?? 250);

export class WebhookService {
  constructor(
    private readonly customerService: CustomerService,
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService,
    private readonly ragService: RagService,
    private readonly promptService: PromptService,
    private readonly webhookEventRepo: WebhookEventRepository,
    private readonly groqClient: GroqClient,
    private readonly instagramClient: InstagramClient,
  ) {}

  async handleIncomingMessage(event: InstagramMessagingEvent): Promise<void> {
    if (event.message?.is_echo) {
      return; // the bot's own outbound message reflected back
    }

    const dedupeKey = this.resolveDedupeKey(event);
    if (dedupeKey) {
      const isNew = await this.webhookEventRepo.markProcessed(dedupeKey);
      if (!isNew) {
        logger.info('webhook_duplicate_skipped', { dedupeKey });
        return;
      }
    }

    if (event.reaction && !event.message) {
      logger.info('webhook_reaction_ignored', { senderId: event.sender.id, reaction: event.reaction.reaction });
      return; // a reaction isn't a message needing an answer
    }

    const { text, isAttachmentOnly, attachmentType } = this.extractText(event);
    if (text === null) {
      logger.info('webhook_event_no_text', { senderId: event.sender.id });
      return; // nothing actionable in this event
    }

    const customer = await this.customerService.getOrCreateCustomer(event.sender.id);
    const conversation = await this.conversationService.getOrCreateActiveConversation(customer.id);

    await this.messageService.saveUserMessage(conversation.id, text, event.message?.mid);
    // The insert above triggers conversations.message_count += 1 in the DB;
    // reflect that locally so maybeSummarize's threshold check is accurate.
    conversation.messageCount += 1;

    if (isAttachmentOnly) {
      const canned = getAttachmentCannedResponse(attachmentType);
      await this.replyWithCanned(conversation.id, event.sender.id, event.recipient.id, canned);
      return;
    }

    const { intent, cannedResponse } = detectIntent(text);
    if (intent !== 'business_question' && cannedResponse) {
      await this.replyWithCanned(conversation.id, event.sender.id, event.recipient.id, cannedResponse);
      return;
    }

    await this.conversationService.maybeSummarize(conversation);
    const history = await this.conversationService.loadHistoryForPrompt(conversation.id);
    const ragContext = await this.ragService.retrieveContext(text);

    const prompt = this.promptService.buildPrompt({
      knowledgeContext: ragContext.contextText,
      conversationSummary: history.summary,
      recentMessages: history.recentMessages,
      userQuestion: text,
    });

    let replyText: string;
    let completionTokens = 0;
    try {
      const result = await this.groqClient.createCompletion(prompt.chatMessages, {
        maxTokens: ANSWER_MAX_TOKENS,
      });
      replyText = result.content || FALLBACK_ANSWER;
      completionTokens = result.completionTokens;
    } catch (err) {
      logger.error('groq_completion_failed', { error: String(err), conversationId: conversation.id });
      replyText = FALLBACK_ANSWER;
    }

    await this.messageService.saveAssistantMessage(conversation.id, replyText, completionTokens);

    try {
      await this.instagramClient.sendMessage(event.sender.id, replyText, event.recipient.id);
    } catch (err) {
      logger.error('instagram_reply_failed', { error: String(err), senderId: event.sender.id });
    }
  }

  private async replyWithCanned(
    conversationId: string,
    senderId: string,
    igBusinessAccountId: string,
    canned: string,
  ): Promise<void> {
    await this.messageService.saveAssistantMessage(conversationId, canned, 0);
    try {
      await this.instagramClient.sendMessage(senderId, canned, igBusinessAccountId);
    } catch (err) {
      logger.error('instagram_reply_failed', { error: String(err), senderId });
    }
  }

  private resolveDedupeKey(event: InstagramMessagingEvent): string | null {
    if (event.message?.mid) return event.message.mid;
    if (event.postback) return `postback:${event.sender.id}:${event.timestamp}:${event.postback.payload}`;
    return null; // reactions aren't deduped — they're cheap to re-process (log + no-op)
  }

  private extractText(event: InstagramMessagingEvent): {
    text: string | null;
    isAttachmentOnly: boolean;
    attachmentType: string | null;
  } {
    if (event.message?.text) {
      return { text: event.message.text, isAttachmentOnly: false, attachmentType: null };
    }

    if (event.postback?.payload) {
      return { text: event.postback.payload, isAttachmentOnly: false, attachmentType: null };
    }

    if (event.message?.attachments && event.message.attachments.length > 0) {
      const type = event.message.attachments[0]?.type ?? 'default';
      return {
        text: `[attachment: ${type}]`,
        isAttachmentOnly: true,
        attachmentType: type,
      };
    }

    return { text: null, isAttachmentOnly: false, attachmentType: null };
  }
}
