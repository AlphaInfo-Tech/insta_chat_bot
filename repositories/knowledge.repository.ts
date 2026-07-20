import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/database/types';
import type {
  KnowledgeDoc,
  CreateKnowledgeInput,
  UpsertKnowledgePageInput,
  KnowledgeFileSummary,
} from '@/types/knowledge';

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

  /** Top-N semantic matches via the match_knowledge RPC (pgvector cosine similarity, HNSW-indexed). */
  async searchByEmbedding(queryEmbedding: number[], matchLimit = 5): Promise<KnowledgeDoc[]> {
    const { data, error } = await this.db.rpc('match_knowledge', {
      query_embedding: queryEmbedding,
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
          embedding: input.embedding,
        },
        { onConflict: 'source_file,source_page' },
      )
      .select('*')
      .single();

    if (error) throw error;
    return mapRow(data);
  }

  /**
   * One row per source file, aggregated across its pages. Rows come back
   * ordered newest-first by created_at, so the first row seen per file is
   * already its most recently ingested page.
   */
  async listFiles(): Promise<KnowledgeFileSummary[]> {
    const { data, error } = await this.db
      .from('knowledge')
      .select('source_file, category, created_at')
      .not('source_file', 'is', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const byFile = new Map<string, KnowledgeFileSummary>();
    for (const row of data ?? []) {
      if (!row.source_file) continue;
      const existing = byFile.get(row.source_file);
      if (existing) {
        existing.pageCount += 1;
      } else {
        byFile.set(row.source_file, {
          sourceFile: row.source_file,
          category: row.category,
          pageCount: 1,
          uploadedAt: row.created_at,
        });
      }
    }
    return Array.from(byFile.values());
  }

  /** Deletes every page row belonging to a source file. */
  async deleteByFile(sourceFile: string): Promise<void> {
    const { error } = await this.db.from('knowledge').delete().eq('source_file', sourceFile);
    if (error) throw error;
  }
}
