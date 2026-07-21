import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/database/types';
import type { ListOptions, ListResult } from '@/types/pagination';
import { toRange } from '@/lib/adminPagination';

export interface ProcessedWebhookEvent {
  id: string;
  instagramMessageId: string;
  processedAt: string;
}

function mapRow(row: Database['public']['Tables']['processed_webhook_events']['Row']): ProcessedWebhookEvent {
  return {
    id: row.id,
    instagramMessageId: row.instagram_message_id,
    processedAt: row.processed_at,
  };
}

export class WebhookEventRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  /**
   * Insert-on-conflict-do-nothing dedup check. Returns true when this is a
   * newly-seen instagram_message_id (caller should proceed), false when it's
   * a duplicate delivery (caller should short-circuit).
   */
  async markProcessed(instagramMessageId: string): Promise<boolean> {
    const { data, error } = await this.db
      .from('processed_webhook_events')
      .upsert(
        { instagram_message_id: instagramMessageId },
        { onConflict: 'instagram_message_id', ignoreDuplicates: true },
      )
      .select('id');

    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }

  /** View-only listing for the admin dashboard — no per-row edit/delete, this table is pure dedup plumbing. */
  async list(opts: ListOptions): Promise<ListResult<ProcessedWebhookEvent>> {
    const [from, to] = toRange(opts.page, opts.pageSize);
    const { data, error, count } = await this.db
      .from('processed_webhook_events')
      .select('*', { count: 'exact' })
      .order('processed_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { rows: (data ?? []).map(mapRow), total: count ?? 0, page: opts.page, pageSize: opts.pageSize };
  }

  /** Bulk cleanup for a table the SQL schema notes grows unboundedly with no scheduled job. Returns the number of rows removed. */
  async purgeOlderThan(cutoffIso: string): Promise<number> {
    const { data, error } = await this.db
      .from('processed_webhook_events')
      .delete()
      .lt('processed_at', cutoffIso)
      .select('id');

    if (error) throw error;
    return data?.length ?? 0;
  }
}
