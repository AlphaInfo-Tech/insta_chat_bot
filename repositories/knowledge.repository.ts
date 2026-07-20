import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/database/types';
import type { KnowledgeDoc, CreateKnowledgeInput, UpsertKnowledgePageInput } from '@/types/knowledge';

function mapRow(row: Database['public']['Tables']['knowledge']['Row']): KnowledgeDoc {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    content: row.content,
    sourceFile: row.source_file,
    sourcePage: row.source_page,
  };
}

export class KnowledgeRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  /** Top-N FTS matches via the search_knowledge RPC (plainto_tsquery + ts_rank, GIN-indexed). */
  async searchByQuery(query: string, matchLimit = 5): Promise<KnowledgeDoc[]> {
    const { data, error } = await this.db.rpc('search_knowledge', {
      query,
      match_limit: matchLimit,
    });

    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      content: row.content,
      sourceFile: row.source_file,
      sourcePage: row.source_page,
      rank: row.rank,
    }));
  }

  /** Single-row admin helper for manually-entered knowledge (no source file/page). */
  async create(input: CreateKnowledgeInput): Promise<KnowledgeDoc> {
    const { data, error } = await this.db
      .from('knowledge')
      .insert({
        title: input.title,
        category: input.category ?? null,
        keywords: input.keywords ?? null,
        content: input.content,
      })
      .select('*')
      .single();

    if (error) throw error;
    return mapRow(data);
  }

  async findById(id: string): Promise<KnowledgeDoc | null> {
    const { data, error } = await this.db.from('knowledge').select('*').eq('id', id).maybeSingle();

    if (error) throw error;
    return data ? mapRow(data) : null;
  }

  /**
   * Idempotent PDF/TXT-page ingestion: upserts on (source_file, source_page)
   * so re-uploading a corrected file replaces its rows instead of
   * duplicating them.
   */
  async upsertPage(input: UpsertKnowledgePageInput): Promise<KnowledgeDoc> {
    const { data, error } = await this.db
      .from('knowledge')
      .upsert(
        {
          title: input.title,
          category: input.category ?? null,
          keywords: input.keywords ?? null,
          content: input.content,
          source_file: input.sourceFile,
          source_page: input.sourcePage,
        },
        { onConflict: 'source_file,source_page' },
      )
      .select('*')
      .single();

    if (error) throw error;
    return mapRow(data);
  }
}
