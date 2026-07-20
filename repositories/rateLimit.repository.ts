import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/database/types';
import type { RateLimitRecord } from '@/types/rateLimit';

function mapRow(row: Database['public']['Tables']['rate_limits']['Row']): RateLimitRecord {
  return {
    id: row.id,
    rateKey: row.rate_key,
    windowStart: row.window_start,
    requestCount: row.request_count,
  };
}

export class RateLimitRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  /**
   * Atomic upsert on the unique(rate_key, window_start) constraint: first
   * request in a window inserts request_count=1, subsequent ones increment.
   * Single round trip, race-safe under concurrent invocations.
   */
  async incrementAndGet(rateKey: string, windowStart: string): Promise<RateLimitRecord> {
    const { data, error } = await this.db.rpc('increment_rate_limit', {
      p_rate_key: rateKey,
      p_window_start: windowStart,
    });

    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('increment_rate_limit returned no row');
    return mapRow(row);
  }
}
