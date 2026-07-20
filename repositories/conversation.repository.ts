import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/database/types';
import type { Conversation, ConversationSummary } from '@/types/conversation';

function mapConversationRow(
  row: Database['public']['Tables']['conversations']['Row'],
): Conversation {
  return {
    id: row.id,
    customerId: row.customer_id,
    status: row.status,
    messageCount: row.message_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSummaryRow(
  row: Database['public']['Tables']['conversation_summaries']['Row'],
): ConversationSummary {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    summary: row.summary,
    messageCountAtSummary: row.message_count_at_summary,
    createdAt: row.created_at,
  };
}

export class ConversationRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findActiveByCustomerId(customerId: string): Promise<Conversation | null> {
    const { data, error } = await this.db
      .from('conversations')
      .select('*')
      .eq('customer_id', customerId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data ? mapConversationRow(data) : null;
  }

  async create(customerId: string): Promise<Conversation> {
    const { data, error } = await this.db
      .from('conversations')
      .insert({ customer_id: customerId })
      .select('*')
      .single();

    if (error) throw error;
    return mapConversationRow(data);
  }

  async findOrCreateActive(customerId: string): Promise<Conversation> {
    const existing = await this.findActiveByCustomerId(customerId);
    if (existing) return existing;
    return this.create(customerId);
  }

  async getMessageCount(conversationId: string): Promise<number> {
    const { data, error } = await this.db
      .from('conversations')
      .select('message_count')
      .eq('id', conversationId)
      .single();

    if (error) throw error;
    return data.message_count;
  }

  async close(conversationId: string): Promise<void> {
    const { error } = await this.db
      .from('conversations')
      .update({ status: 'closed' })
      .eq('id', conversationId);

    if (error) throw error;
  }

  async getLatestSummary(conversationId: string): Promise<ConversationSummary | null> {
    const { data, error } = await this.db
      .from('conversation_summaries')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data ? mapSummaryRow(data) : null;
  }

  async saveSummary(
    conversationId: string,
    summary: string,
    messageCountAtSummary: number,
  ): Promise<ConversationSummary> {
    const { data, error } = await this.db
      .from('conversation_summaries')
      .insert({
        conversation_id: conversationId,
        summary,
        message_count_at_summary: messageCountAtSummary,
      })
      .select('*')
      .single();

    if (error) throw error;
    return mapSummaryRow(data);
  }
}
