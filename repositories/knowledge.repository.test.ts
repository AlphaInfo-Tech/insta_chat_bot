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

  it('listFiles aggregates page rows into one summary per source file', async () => {
    const db = createMockSupabaseClient({
      fromResult: {
        data: [
          { source_file: 'faq.pdf', category: 'support', created_at: '2026-07-20T10:00:00Z' },
          { source_file: 'faq.pdf', category: 'support', created_at: '2026-07-20T09:00:00Z' },
          { source_file: 'refunds.txt', category: 'billing', created_at: '2026-07-19T08:00:00Z' },
        ],
        error: null,
      },
    });
    const repo = new KnowledgeRepository(asClient(db));

    const files = await repo.listFiles();

    expect(files).toEqual([
      { sourceFile: 'faq.pdf', category: 'support', pageCount: 2, uploadedAt: '2026-07-20T10:00:00Z' },
      { sourceFile: 'refunds.txt', category: 'billing', pageCount: 1, uploadedAt: '2026-07-19T08:00:00Z' },
    ]);
  });

  it('listFiles returns an empty array when no files have been ingested', async () => {
    const db = createMockSupabaseClient({ fromResult: { data: [], error: null } });
    const repo = new KnowledgeRepository(asClient(db));

    expect(await repo.listFiles()).toEqual([]);
  });

  it('deleteByFile deletes without throwing when Supabase reports no error', async () => {
    const db = createMockSupabaseClient({ fromResult: { data: null, error: null } });
    const repo = new KnowledgeRepository(asClient(db));

    await expect(repo.deleteByFile('faq.pdf')).resolves.toBeUndefined();
  });

  it('deleteByFile throws when Supabase reports an error', async () => {
    const db = createMockSupabaseClient({ fromResult: { data: null, error: { message: 'boom' } } });
    const repo = new KnowledgeRepository(asClient(db));

    await expect(repo.deleteByFile('faq.pdf')).rejects.toEqual({ message: 'boom' });
  });
});
