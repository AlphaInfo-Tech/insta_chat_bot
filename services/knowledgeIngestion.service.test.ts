import { describe, it, expect, vi } from 'vitest';
import type { KnowledgeRepository } from '@/repositories/knowledge.repository';
import type { EmbeddingsClient } from '@/lib/embeddings';
import { KnowledgeIngestionService } from './knowledgeIngestion.service';

const FAKE_EMBEDDING = [0.1, 0.2, 0.3];

function fakeEmbeddingsClient(): EmbeddingsClient {
  return { embed: vi.fn().mockResolvedValue(FAKE_EMBEDDING) } as unknown as EmbeddingsClient;
}

describe('KnowledgeIngestionService', () => {
  it('ingests a plain TXT file as a single page when there are no form-feed breaks', async () => {
    const upsertPage = vi.fn().mockImplementation(async (input) => ({ id: 'k1', ...input }));
    const knowledgeRepo = { upsertPage } as unknown as KnowledgeRepository;
    const service = new KnowledgeIngestionService(knowledgeRepo, async () => [], fakeEmbeddingsClient());

    const buffer = Buffer.from('Our refund policy is 30 days.', 'utf-8');
    const docs = await service.ingestFile(buffer, 'refunds.txt', 'billing');

    expect(docs).toHaveLength(1);
    expect(upsertPage).toHaveBeenCalledWith({
      title: 'refunds.txt — Page 1',
      category: 'billing',
      content: 'Our refund policy is 30 days.',
      sourceFile: 'refunds.txt',
      sourcePage: 1,
      embedding: FAKE_EMBEDDING,
    });
  });

  it('splits a TXT file on form-feed page breaks into multiple rows', async () => {
    const upsertPage = vi.fn().mockImplementation(async (input) => ({ id: input.sourcePage, ...input }));
    const knowledgeRepo = { upsertPage } as unknown as KnowledgeRepository;
    const service = new KnowledgeIngestionService(knowledgeRepo, async () => [], fakeEmbeddingsClient());

    const buffer = Buffer.from('Page one text.\fPage two text.\fPage three text.', 'utf-8');
    const docs = await service.ingestFile(buffer, 'faq.txt');

    expect(docs).toHaveLength(3);
    expect(upsertPage).toHaveBeenNthCalledWith(1, expect.objectContaining({ sourcePage: 1, content: 'Page one text.' }));
    expect(upsertPage).toHaveBeenNthCalledWith(3, expect.objectContaining({ sourcePage: 3, content: 'Page three text.' }));
  });

  it('uses the injected PDF page extractor and maps each page to a row', async () => {
    const upsertPage = vi.fn().mockImplementation(async (input) => ({ id: input.sourcePage, ...input }));
    const knowledgeRepo = { upsertPage } as unknown as KnowledgeRepository;
    const extractPdfPages = vi.fn().mockResolvedValue(['Page 1 content', 'Page 2 content']);
    const service = new KnowledgeIngestionService(knowledgeRepo, extractPdfPages, fakeEmbeddingsClient());

    const docs = await service.ingestFile(Buffer.from('%PDF-fake'), 'manual.pdf', 'support');

    expect(extractPdfPages).toHaveBeenCalledTimes(1);
    expect(docs).toHaveLength(2);
    expect(upsertPage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ title: 'manual.pdf — Page 1', sourcePage: 1, category: 'support' }),
    );
  });

  it('defaults category to "general" when none is provided', async () => {
    const upsertPage = vi.fn().mockImplementation(async (input) => ({ id: 1, ...input }));
    const knowledgeRepo = { upsertPage } as unknown as KnowledgeRepository;
    const service = new KnowledgeIngestionService(knowledgeRepo, async () => [], fakeEmbeddingsClient());

    await service.ingestFile(Buffer.from('hello'), 'notes.txt');

    expect(upsertPage).toHaveBeenCalledWith(expect.objectContaining({ category: 'general' }));
  });

  it('embeds each page and passes the vector through to upsertPage', async () => {
    const upsertPage = vi.fn().mockImplementation(async (input) => ({ id: 1, ...input }));
    const knowledgeRepo = { upsertPage } as unknown as KnowledgeRepository;
    const embeddingsClient = fakeEmbeddingsClient();
    const service = new KnowledgeIngestionService(knowledgeRepo, async () => [], embeddingsClient);

    await service.ingestFile(Buffer.from('Our refund policy is 30 days.'), 'refunds.txt');

    expect(embeddingsClient.embed).toHaveBeenCalledWith('Our refund policy is 30 days.');
    expect(upsertPage).toHaveBeenCalledWith(expect.objectContaining({ embedding: FAKE_EMBEDDING }));
  });

  it('listFiles delegates to the repository', async () => {
    const summaries = [{ sourceFile: 'faq.pdf', category: 'support', pageCount: 3, uploadedAt: '2026-07-20T10:00:00Z' }];
    const listFiles = vi.fn().mockResolvedValue(summaries);
    const knowledgeRepo = { listFiles } as unknown as KnowledgeRepository;
    const service = new KnowledgeIngestionService(knowledgeRepo, async () => [], fakeEmbeddingsClient());

    expect(await service.listFiles()).toEqual(summaries);
  });

  it('deleteFile delegates to the repository', async () => {
    const deleteByFile = vi.fn().mockResolvedValue(undefined);
    const knowledgeRepo = { deleteByFile } as unknown as KnowledgeRepository;
    const service = new KnowledgeIngestionService(knowledgeRepo, async () => [], fakeEmbeddingsClient());

    await service.deleteFile('faq.pdf');

    expect(deleteByFile).toHaveBeenCalledWith('faq.pdf');
  });
});
