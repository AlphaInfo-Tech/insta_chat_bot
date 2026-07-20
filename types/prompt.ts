import type { Message } from './message';
import type { GroqChatMessage } from './groq';

export interface PromptAssembly {
  systemPrompt: string;
  knowledgeContext: string;
  conversationSummary: string | null;
  recentMessages: Message[];
  userQuestion: string;
  /** Flattened for logging only; the actual Groq call uses `chatMessages`. */
  fullPrompt: string;
  chatMessages: GroqChatMessage[];
  estimatedTokens: number;
}
