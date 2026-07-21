import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/database/types';
import type { AppSettings, UpdateSettingsInput } from '@/types/settings';

const SETTINGS_ROW_ID = 1;

function mapRow(row: Database['public']['Tables']['settings']['Row']): AppSettings {
  return {
    agentName: row.agent_name,
    companyName: row.company_name,
    consultCta: row.consult_cta,
    whatsappCta: row.whatsapp_cta,
    fallbackAnswer: row.fallback_answer,
    knowledgeContextMaxTokens: row.knowledge_context_max_tokens,
    conversationHistoryMaxTokens: row.conversation_history_max_tokens,
    answerMaxTokens: row.answer_max_tokens,
    summarizationThresholdMessages: row.summarization_threshold_messages,
  };
}

export class SettingsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  /** The seed migration guarantees exactly one row (id=1) always exists. */
  async get(): Promise<AppSettings> {
    const { data, error } = await this.db.from('settings').select('*').eq('id', SETTINGS_ROW_ID).single();

    if (error) throw error;
    return mapRow(data);
  }

  async update(input: UpdateSettingsInput): Promise<AppSettings> {
    const { data, error } = await this.db
      .from('settings')
      .update({
        ...(input.agentName !== undefined && { agent_name: input.agentName }),
        ...(input.companyName !== undefined && { company_name: input.companyName }),
        ...(input.consultCta !== undefined && { consult_cta: input.consultCta }),
        ...(input.whatsappCta !== undefined && { whatsapp_cta: input.whatsappCta }),
        ...(input.fallbackAnswer !== undefined && { fallback_answer: input.fallbackAnswer }),
        ...(input.knowledgeContextMaxTokens !== undefined && {
          knowledge_context_max_tokens: input.knowledgeContextMaxTokens,
        }),
        ...(input.conversationHistoryMaxTokens !== undefined && {
          conversation_history_max_tokens: input.conversationHistoryMaxTokens,
        }),
        ...(input.answerMaxTokens !== undefined && { answer_max_tokens: input.answerMaxTokens }),
        ...(input.summarizationThresholdMessages !== undefined && {
          summarization_threshold_messages: input.summarizationThresholdMessages,
        }),
      })
      .eq('id', SETTINGS_ROW_ID)
      .select('*')
      .single();

    if (error) throw error;
    return mapRow(data);
  }
}
