export type ConversationStatus = 'active' | 'closed';

export interface Conversation {
  id: string;
  customerId: string;
  status: ConversationStatus;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationSummary {
  id: string;
  conversationId: string;
  summary: string;
  messageCountAtSummary: number;
  createdAt: string;
}
