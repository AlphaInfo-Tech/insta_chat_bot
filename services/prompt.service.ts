import { buildSystemPrompt } from '@/prompts/systemPrompt';
import { estimateTokens, truncateToTokenBudget } from '@/utils/tokenCounter';
import type { Message } from '@/types/message';
import type { GroqChatMessage } from '@/types/groq';
import type { PromptAssembly } from '@/types/prompt';
import type { AppSettings } from '@/types/settings';

export interface BuildPromptInput {
  knowledgeContext: string;
  conversationSummary: string | null;
  recentMessages: Message[];
  userQuestion: string;
  settings: AppSettings;
}

function formatMessageLine(m: Message): string {
  return `${m.role === 'user' ? 'Customer' : 'Assistant'}: ${m.message}`;
}

/** Drops oldest messages first, keeping the most recent ones, until under budget. */
function truncateHistory(messages: Message[], maxTokens: number): Message[] {
  const kept: Message[] = [];
  let used = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (!message) continue;
    const lineTokens = estimateTokens(formatMessageLine(message));
    if (used + lineTokens > maxTokens) break;
    kept.unshift(message);
    used += lineTokens;
  }

  return kept;
}

export class PromptService {
  buildPrompt(input: BuildPromptInput): PromptAssembly {
    const knowledgeContext = truncateToTokenBudget(input.knowledgeContext, input.settings.knowledgeContextMaxTokens);
    const truncatedHistory = truncateHistory(input.recentMessages, input.settings.conversationHistoryMaxTokens);
    const historyText = truncatedHistory.map(formatMessageLine).join('\n');

    const filledSystemPrompt = buildSystemPrompt(input.settings).replace(
      '{rag_context}',
      knowledgeContext || '(none found)',
    );

    const contextSections = [
      filledSystemPrompt,
      input.conversationSummary ? `Conversation Summary:\n${input.conversationSummary}` : null,
    ].filter((section): section is string => section !== null);

    const systemMessage = contextSections.join('\n\n');

    const chatMessages: GroqChatMessage[] = [
      { role: 'system', content: systemMessage },
      ...truncatedHistory.map((m): GroqChatMessage => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.message,
      })),
      { role: 'user', content: input.userQuestion },
    ];

    const fullPrompt = [
      systemMessage,
      historyText ? `Recent Messages:\n${historyText}` : null,
      `Current User Question:\n${input.userQuestion}`,
    ]
      .filter((section): section is string => section !== null)
      .join('\n\n');

    return {
      systemPrompt: filledSystemPrompt,
      knowledgeContext,
      conversationSummary: input.conversationSummary,
      recentMessages: truncatedHistory,
      userQuestion: input.userQuestion,
      fullPrompt,
      chatMessages,
      estimatedTokens: estimateTokens(fullPrompt),
    };
  }
}
