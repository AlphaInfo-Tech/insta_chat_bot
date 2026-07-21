import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/database/types';
import type { Message, CreateMessageInput, UpdateMessageInput, MessageRole } from '@/types/message';
import type { ListOptions, ListResult } from '@/types/pagination';
import { toRange } from '@/lib/adminPagination';

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

  async list(
    opts: ListOptions & { conversationId?: string; role?: MessageRole },
  ): Promise<ListResult<Message>> {
    const [from, to] = toRange(opts.page, opts.pageSize);
    let query = this.db.from('messages').select('*', { count: 'exact' });

    if (opts.conversationId) query = query.eq('conversation_id', opts.conversationId);
    if (opts.role) query = query.eq('role', opts.role);
    if (opts.search) query = query.ilike('message', `%${opts.search.replace(/[%,]/g, '')}%`);

    const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);

    if (error) throw error;
    return { rows: (data ?? []).map(mapRow), total: count ?? 0, page: opts.page, pageSize: opts.pageSize };
  }

  async update(id: string, input: UpdateMessageInput): Promise<Message> {
    const { data, error } = await this.db
      .from('messages')
      .update({ ...(input.message !== undefined && { message: input.message }) })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return mapRow(data);
  }

  /**
   * Note: conversations.message_count is trigger-incremented on insert only,
   * so deleting a message here does not decrement it — pre-existing trigger
   * design, not something this method changes.
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.db.from('messages').delete().eq('id', id);
    if (error) throw error;
  }
}
