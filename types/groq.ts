export interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqCompletionResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  model: string;
}

export interface GroqCompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}
