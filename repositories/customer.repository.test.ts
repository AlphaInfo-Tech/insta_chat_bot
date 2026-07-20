import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/database/types';
import { CustomerRepository } from './customer.repository';
import { createMockSupabaseClient } from './__testUtils__/mockSupabase';

function asClient(mock: unknown) {
  return mock as SupabaseClient<Database>;
}

describe('CustomerRepository', () => {
  it('findByInstagramId returns null when no row is found', async () => {
    const db = createMockSupabaseClient({ fromResult: { data: null, error: null } });
    const repo = new CustomerRepository(asClient(db));

    const result = await repo.findByInstagramId('ig-123');

    expect(result).toBeNull();
  });

  it('findByInstagramId maps a found row to the camelCase Customer shape', async () => {
    const db = createMockSupabaseClient({
      fromResult: {
        data: { id: 'uuid-1', instagram_id: 'ig-123', username: 'alice', created_at: '2026-01-01T00:00:00Z' },
        error: null,
      },
    });
    const repo = new CustomerRepository(asClient(db));

    const result = await repo.findByInstagramId('ig-123');

    expect(result).toEqual({
      id: 'uuid-1',
      instagramId: 'ig-123',
      username: 'alice',
      createdAt: '2026-01-01T00:00:00Z',
    });
  });

  it('create() throws when Supabase returns an error', async () => {
    const db = createMockSupabaseClient({
      fromResult: { data: null, error: { message: 'insert failed' } },
    });
    const repo = new CustomerRepository(asClient(db));

    await expect(repo.create({ instagramId: 'ig-999' })).rejects.toEqual({ message: 'insert failed' });
  });
});
