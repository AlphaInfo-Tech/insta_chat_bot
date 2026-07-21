import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/database/types';
import type { RateLimitRecord } from '@/types/rateLimit';
import type { ListOptions, ListResult } from '@/types/pagination';
import { toRange } from '@/lib/adminPagination';

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

  async list(opts: ListOptions): Promise<ListResult<RateLimitRecord>> {
    const [from, to] = toRange(opts.page, opts.pageSize);
    let query = this.db.from('rate_limits').select('*', { count: 'exact' });

    if (opts.search) query = query.ilike('rate_key', `%${opts.search.replace(/[%,]/g, '')}%`);

    const { data, error, count } = await query.order('window_start', { ascending: false }).range(from, to);

    if (error) throw error;
    return { rows: (data ?? []).map(mapRow), total: count ?? 0, page: opts.page, pageSize: opts.pageSize };
  }

  /** Deletes a rate-limit window row, effectively un-blocking that sender immediately. */
  async delete(id: string): Promise<void> {
    const { error } = await this.db.from('rate_limits').delete().eq('id', id);
    if (error) throw error;
  }
}
