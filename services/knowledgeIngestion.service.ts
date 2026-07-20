import type { KnowledgeRepository } from '@/repositories/knowledge.repository';
import type { KnowledgeDoc } from '@/types/knowledge';
import { logger } from '@/utils/logger';

const DEFAULT_CATEGORY = 'general';
/** Conventional plain-text page-break marker; TXT files without one are treated as a single page. */
const FORM_FEED = '\f';

export class KnowledgeIngestionService {
  constructor(
    private readonly knowledgeRepo: KnowledgeRepository,
    private readonly extractPdfPages: (buffer: Buffer) => Promise<string[]>,
  ) {}

  async ingestFile(buffer: Buffer, filename: string, category?: string): Promise<KnowledgeDoc[]> {
    const ext = filename.toLowerCase().split('.').pop();
    const pages = ext === 'pdf' ? await this.extractPdfPages(buffer) : this.splitTxtPages(buffer);

    const resolvedCategory = category ?? DEFAULT_CATEGORY;
    const inserted: KnowledgeDoc[] = [];

    for (let i = 0; i < pages.length; i++) {
      const pageText = pages[i]?.trim();
      if (!pageText) continue;

      const pageNumber = i + 1;
      const doc = await this.knowledgeRepo.upsertPage({
        title: `${filename} — Page ${pageNumber}`,
        category: resolvedCategory,
        content: pageText,
        sourceFile: filename,
        sourcePage: pageNumber,
      });
      inserted.push(doc);
    }

    logger.info('knowledge_ingested', { filename, pageCount: inserted.length, category: resolvedCategory });
    return inserted;
  }

  private splitTxtPages(buffer: Buffer): string[] {
    const text = buffer.toString('utf-8');
    if (text.includes(FORM_FEED)) {
      return text.split(FORM_FEED);
    }
    return [text];
  }
}
