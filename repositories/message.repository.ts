import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/database/types';
import type { Message, CreateMessageInput } from '@/types/message';

function mapRow(row: Database['public']['Tables']['messages']['Row']): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    message: row.message,
    tokens: row.tokens,
    instagramMessageId: row.instagram_message_id,
    createdAt: row.created_at,
  };
}

export class MessageRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async create(input: CreateMessageInput): Promise<Message> {
    const { data, error } = await this.db
      .from('messages')
      .insert({
        conversation_id: input.conversationId,
        role: input.role,
        message: input.message,
        tokens: input.tokens ?? null,
        instagram_message_id: input.instagramMessageId ?? null,
      })
      .select('*')
      .single();

    if (error) throw error;
    return mapRow(data);
  }

  /** Ordered created_at ascending — the shape prompt.service.ts needs directly. */
  async findRecentByConversationId(conversationId: string, limit = 10): Promise<Message[]> {
    const { data, error } = await this.db
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map(mapRow).reverse();
  }

  async existsByInstagramMessageId(instagramMessageId: string): Promise<boolean> {
    const { data, error } = await this.db
      .from('messages')
      .select('id')
      .eq('instagram_message_id', instagramMessageId)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data !== null;
  }
}
