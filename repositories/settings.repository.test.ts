import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/database/types';
import { SettingsRepository } from './settings.repository';
import { createMockSupabaseClient } from './__testUtils__/mockSupabase';

function asClient(mock: unknown) {
  return mock as SupabaseClient<Database>;
}

const ROW = {
  id: 1,
  agent_name: 'Aria',
  company_name: 'Alpha Info Tech',
  consult_cta: 'Book a call?',
  whatsapp_cta: 'Reach us on WhatsApp',
  fallback_answer: 'Let me connect you with the team.',
  knowledge_context_max_tokens: 1200,
  conversation_history_max_tokens: 600,
  answer_max_tokens: 250,
  summarization_threshold_messages: 50,
  updated_at: '2026-07-21T00:00:00Z',
};

describe('SettingsRepository', () => {
  it('get() maps the single settings row to the camelCase AppSettings shape', async () => {
    const db = createMockSupabaseClient({ fromResult: { data: ROW, error: null } });
    const repo = new SettingsRepository(asClient(db));

    const result = await repo.get();

    expect(result).toEqual({
      agentName: 'Aria',
      companyName: 'Alpha Info Tech',
      consultCta: 'Book a call?',
      whatsappCta: 'Reach us on WhatsApp',
      fallbackAnswer: 'Let me connect you with the team.',
      knowledgeContextMaxTokens: 1200,
      conversationHistoryMaxTokens: 600,
      answerMaxTokens: 250,
      summarizationThresholdMessages: 50,
    });
  });

  it('get() throws when Supabase returns an error', async () => {
    const db = createMockSupabaseClient({ fromResult: { data: null, error: { message: 'no row' } } });
    const repo = new SettingsRepository(asClient(db));

    await expect(repo.get()).rejects.toEqual({ message: 'no row' });
  });

  it('update() maps the updated row back to AppSettings', async () => {
    const db = createMockSupabaseClient({
      fromResult: { data: { ...ROW, agent_name: 'Nova' }, error: null },
    });
    const repo = new SettingsRepository(asClient(db));

    const result = await repo.update({ agentName: 'Nova' });

    expect(result.agentName).toBe('Nova');
  });
});
