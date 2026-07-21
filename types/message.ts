export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  message: string;
  tokens: number | null;
  instagramMessageId: string | null;
  createdAt: string;
}

export interface CreateMessageInput {
  conversationId: string;
  role: MessageRole;
  message: string;
  tokens?: number;
  instagramMessageId?: string;
}

export interface UpdateMessageInput {
  message?: string;
}
