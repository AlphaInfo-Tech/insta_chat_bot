import type { MessageRepository } from '@/repositories/message.repository';
import type { Message } from '@/types/message';

export class MessageService {
  constructor(private readonly messageRepo: MessageRepository) {}

  async saveUserMessage(conversationId: string, text: string, instagramMessageId?: string): Promise<Message> {
    return this.messageRepo.create({
      conversationId,
      role: 'user',
      message: text,
      instagramMessageId,
    });
  }

  async saveAssistantMessage(conversationId: string, text: string, tokens = 0): Promise<Message> {
    return this.messageRepo.create({
      conversationId,
      role: 'assistant',
      message: text,
      tokens,
    });
  }
}
