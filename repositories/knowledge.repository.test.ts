import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/database/types';
import { KnowledgeRepository } from './knowledge.repository';
import { createMockSupabaseClient } from './__testUtils__/mockSupabase';

function asClient(mock: unknown) {
  return mock as SupabaseClient<Database>;
}

describe('KnowledgeRepository', () => {
  it('searchByQuery calls the search_knowledge RPC and maps ranked results', async () => {
    const db = createMockSupabaseClient({
      rpcResult: {
        data: [
          {
            id: 'doc-1',
            title: 'Refund Policy',
            category: 'billing',
            content: 'Refunds are processed within 5 business days.',
            source_file: null,
            source_page: null,
            rank: 0.87,
          },
        ],
        error: null,
      },
    });
    const repo = new KnowledgeRepository(asClient(db));

    const results = await repo.searchByQuery('refund', 5);

    expect(results).toEqual([
      {
        id: 'doc-1',
        title: 'Refund Policy',
        category: 'billing',
        content: 'Refunds are processed within 5 business days.',
        sourceFile: null,
        sourcePage: null,
        rank: 0.87,
      },
    ]);
  });

  it('searchByQuery returns an empty array when there are no matches', async () => {
    const db = createMockSupabaseClient({ rpcResult: { data: [], error: null } });
    const repo = new KnowledgeRepository(asClient(db));

    const results = await repo.searchByQuery('nonexistent-topic');

    expect(results).toEqual([]);
  });
});
