import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/database/types';

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
}
