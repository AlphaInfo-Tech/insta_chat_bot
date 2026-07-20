import { describe, it, expect, vi } from 'vitest';
import type { KnowledgeRepository } from '@/repositories/knowledge.repository';
import { KnowledgeIngestionService } from './knowledgeIngestion.service';

describe('KnowledgeIngestionService', () => {
  it('ingests a plain TXT file as a single page when there are no form-feed breaks', async () => {
    const upsertPage = vi.fn().mockImplementation(async (input) => ({ id: 'k1', ...input }));
    const knowledgeRepo = { upsertPage } as unknown as KnowledgeRepository;
    const service = new KnowledgeIngestionService(knowledgeRepo, async () => []);

    const buffer = Buffer.from('Our refund policy is 30 days.', 'utf-8');
    const docs = await service.ingestFile(buffer, 'refunds.txt', 'billing');

    expect(docs).toHaveLength(1);
    expect(upsertPage).toHaveBeenCalledWith({
      title: 'refunds.txt — Page 1',
      category: 'billing',
      content: 'Our refund policy is 30 days.',
      sourceFile: 'refunds.txt',
      sourcePage: 1,
    });
  });

  it('splits a TXT file on form-feed page breaks into multiple rows', async () => {
    const upsertPage = vi.fn().mockImplementation(async (input) => ({ id: input.sourcePage, ...input }));
    const knowledgeRepo = { upsertPage } as unknown as KnowledgeRepository;
    const service = new KnowledgeIngestionService(knowledgeRepo, async () => []);

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
    const service = new KnowledgeIngestionService(knowledgeRepo, extractPdfPages);

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
    const service = new KnowledgeIngestionService(knowledgeRepo, async () => []);

    await service.ingestFile(Buffer.from('hello'), 'notes.txt');

    expect(upsertPage).toHaveBeenCalledWith(expect.objectContaining({ category: 'general' }));
  });

  it('listFiles delegates to the repository', async () => {
    const summaries = [{ sourceFile: 'faq.pdf', category: 'support', pageCount: 3, uploadedAt: '2026-07-20T10:00:00Z' }];
    const listFiles = vi.fn().mockResolvedValue(summaries);
    const knowledgeRepo = { listFiles } as unknown as KnowledgeRepository;
    const service = new KnowledgeIngestionService(knowledgeRepo, async () => []);

    expect(await service.listFiles()).toEqual(summaries);
  });

  it('deleteFile delegates to the repository', async () => {
    const deleteByFile = vi.fn().mockResolvedValue(undefined);
    const knowledgeRepo = { deleteByFile } as unknown as KnowledgeRepository;
    const service = new KnowledgeIngestionService(knowledgeRepo, async () => []);

    await service.deleteFile('faq.pdf');

    expect(deleteByFile).toHaveBeenCalledWith('faq.pdf');
  });
});
