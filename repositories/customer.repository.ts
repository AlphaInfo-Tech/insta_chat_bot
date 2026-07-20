import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/database/types';
import type { Customer, CreateCustomerInput } from '@/types/customer';

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
}
