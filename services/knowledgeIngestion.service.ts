import type { KnowledgeRepository } from '@/repositories/knowledge.repository';
import type { EmbeddingsClient } from '@/lib/embeddings';
import type { KnowledgeDoc, KnowledgeFileSummary, UpdateKnowledgeInput } from '@/types/knowledge';
import type { ListOptions, ListResult } from '@/types/pagination';
import { logger } from '@/utils/logger';

const DEFAULT_CATEGORY = 'general';
/** Conventional plain-text page-break marker; TXT files without one are treated as a single page. */
const FORM_FEED = '\f';
/**
 * Embedding models have a limited context window and a single embedding
 * covering a large page dilutes its semantic meaning, so every page (PDF or
 * TXT) is further split into fixed-size word chunks before embedding.
 */
const CHUNK_WORDS = Number(process.env.KNOWLEDGE_CHUNK_WORDS ?? 50);

function chunkWords(text: string, maxWords: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(' '));
  }
  return chunks;
}

export class KnowledgeIngestionService {
  constructor(
    private readonly knowledgeRepo: KnowledgeRepository,
    private readonly extractPdfPages: (buffer: Buffer) => Promise<string[]>,
    private readonly embeddingsClient: EmbeddingsClient,
  ) {}

  async ingestFile(buffer: Buffer, filename: string, category?: string): Promise<KnowledgeDoc[]> {
    const ext = filename.toLowerCase().split('.').pop();
    const pages = ext === 'pdf' ? await this.extractPdfPages(buffer) : this.splitTxtPages(buffer);
    const chunks = pages.flatMap((page) => chunkWords(page, CHUNK_WORDS));

    const resolvedCategory = category ?? DEFAULT_CATEGORY;
    const inserted: KnowledgeDoc[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i]?.trim();
      if (!chunkText) continue;

      const chunkNumber = i + 1;
      const embedding = await this.embeddingsClient.embed(chunkText);
      const doc = await this.knowledgeRepo.upsertPage({
        title: `${filename} — Part ${chunkNumber}`,
        category: resolvedCategory,
        content: chunkText,
        sourceFile: filename,
        sourcePage: chunkNumber,
        embedding,
      });
      inserted.push(doc);
    }

    logger.info('knowledge_ingested', { filename, pageCount: inserted.length, category: resolvedCategory });
    return inserted;
  }

  async listFiles(): Promise<KnowledgeFileSummary[]> {
    return this.knowledgeRepo.listFiles();
  }

  async deleteFile(sourceFile: string): Promise<void> {
    await this.knowledgeRepo.deleteByFile(sourceFile);
    logger.info('knowledge_file_deleted', { filename: sourceFile });
  }

  async listRows(opts: ListOptions & { sourceFile?: string; category?: string }): Promise<ListResult<KnowledgeDoc>> {
    return this.knowledgeRepo.list(opts);
  }

  /** Re-embeds via EmbeddingsClient whenever content changes, so vector search never goes stale after an edit. */
  async updateRow(id: string, input: UpdateKnowledgeInput): Promise<KnowledgeDoc> {
    const embedding = input.content !== undefined ? await this.embeddingsClient.embed(input.content) : undefined;
    const updated = await this.knowledgeRepo.update(id, { ...input, embedding });
    logger.info('knowledge_row_updated', { id, reEmbedded: embedding !== undefined });
    return updated;
  }

  async deleteRow(id: string): Promise<void> {
    await this.knowledgeRepo.delete(id);
    logger.info('knowledge_row_deleted', { id });
  }

  private splitTxtPages(buffer: Buffer): string[] {
    const text = buffer.toString('utf-8');
    if (text.includes(FORM_FEED)) {
      return text.split(FORM_FEED);
    }
    return [text];
  }
}
