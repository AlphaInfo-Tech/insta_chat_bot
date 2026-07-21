import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/database/types';
import type { Customer, CreateCustomerInput, UpdateCustomerInput } from '@/types/customer';
import type { ListOptions, ListResult } from '@/types/pagination';
import { toRange } from '@/lib/adminPagination';

function mapRow(row: Database['public']['Tables']['customers']['Row']): Customer {
  return {
    id: row.id,
    instagramId: row.instagram_id,
    username: row.username,
    createdAt: row.created_at,
  };
}

export class CustomerRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findByInstagramId(instagramId: string): Promise<Customer | null> {
    const { data, error } = await this.db
      .from('customers')
      .select('*')
      .eq('instagram_id', instagramId)
      .maybeSingle();

    if (error) throw error;
    return data ? mapRow(data) : null;
  }

  async create(input: CreateCustomerInput): Promise<Customer> {
    const { data, error } = await this.db
      .from('customers')
      .insert({ instagram_id: input.instagramId, username: input.username ?? null })
      .select('*')
      .single();

    if (error) throw error;
    return mapRow(data);
  }

  /**
   * Race-safe find-or-create. Uses insert-on-conflict-do-nothing rather than
   * a plain upsert so a concurrent duplicate insert never clobbers an
   * already-stored username with null.
   */
  async findOrCreate(input: CreateCustomerInput): Promise<Customer> {
    const existing = await this.findByInstagramId(input.instagramId);
    if (existing) return existing;

    const { error } = await this.db
      .from('customers')
      .upsert(
        { instagram_id: input.instagramId, username: input.username ?? null },
        { onConflict: 'instagram_id', ignoreDuplicates: true },
      );

    if (error) throw error;

    const created = await this.findByInstagramId(input.instagramId);
    if (!created) throw new Error(`Failed to find-or-create customer ${input.instagramId}`);
    return created;
  }

  async list(opts: ListOptions): Promise<ListResult<Customer>> {
    const [from, to] = toRange(opts.page, opts.pageSize);
    let query = this.db.from('customers').select('*', { count: 'exact' });

    if (opts.search) {
      const term = opts.search.replace(/[%,]/g, '');
      query = query.or(`username.ilike.%${term}%,instagram_id.ilike.%${term}%`);
    }

    const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);

    if (error) throw error;
    return { rows: (data ?? []).map(mapRow), total: count ?? 0, page: opts.page, pageSize: opts.pageSize };
  }

  async update(id: string, input: UpdateCustomerInput): Promise<Customer> {
    const { data, error } = await this.db
      .from('customers')
      .update({ ...(input.username !== undefined && { username: input.username }) })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return mapRow(data);
  }

  /** Cascades to conversations -> messages/summaries via FK on delete cascade — the caller must confirm this blast radius before calling. */
  async delete(id: string): Promise<void> {
    const { error } = await this.db.from('customers').delete().eq('id', id);
    if (error) throw error;
  }
}
