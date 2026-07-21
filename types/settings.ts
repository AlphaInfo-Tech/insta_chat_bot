export interface AppSettings {
  agentName: string;
  companyName: string;
  consultCta: string;
  whatsappCta: string;
  fallbackAnswer: string;
  knowledgeContextMaxTokens: number;
  conversationHistoryMaxTokens: number;
  answerMaxTokens: number;
  summarizationThresholdMessages: number;
}

export type UpdateSettingsInput = Partial<AppSettings>;

/**
 * Last-resort fallback if the settings row can't be read (DB error on a cold
 * start with nothing cached yet). Mirrors the row sql/013_settings.sql seeds,
 * so behavior matches what shipped before settings became DB-backed.
 */
export const DEFAULT_SETTINGS: AppSettings = {
  agentName: 'Aria',
  companyName: 'Alpha Info Tech',
  consultCta: 'Would you like to book a free 30-minute consultation? I can connect you with our team right now.',
  whatsappCta: 'You can also reach us directly on WhatsApp: +91 99943 12900',
  fallbackAnswer: `That's a great question — let me connect you with someone from our team who can give you the exact answer.

You can reach us on WhatsApp at +91 99943 12900, or book a free 30-minute call at alphainfotech.org.

We typically respond within 2 hours.`,
  knowledgeContextMaxTokens: 1200,
  conversationHistoryMaxTokens: 600,
  answerMaxTokens: 250,
  summarizationThresholdMessages: 50,
};
