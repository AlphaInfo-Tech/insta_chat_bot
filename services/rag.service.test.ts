import { describe, it, expect, vi } from 'vitest';
import type { KnowledgeRepository } from '@/repositories/knowledge.repository';
import type { EmbeddingsClient } from '@/lib/embeddings';
import type { KnowledgeDoc } from '@/types/knowledge';
import { RagService } from './rag.service';
import { estimateTokens } from '@/utils/tokenCounter';

function fakeKnowledgeRepo(docs: KnowledgeDoc[]): KnowledgeRepository {
  return { searchByEmbedding: async () => docs } as unknown as KnowledgeRepository;
}

function fakeEmbeddingsClient(): EmbeddingsClient {
  return { embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]) } as unknown as EmbeddingsClient;
}

describe('RagService', () => {
  it('returns empty context when there are no matches', async () => {
    const service = new RagService(fakeKnowledgeRepo([]), fakeEmbeddingsClient());
    const result = await service.retrieveContext('refund', 1200);
    expect(result.docs).toEqual([]);
    expect(result.contextText).toBe('');
    expect(result.tokenCount).toBe(0);
  });

  it('truncates excerpts to stay within the knowledge-context token budget', async () => {
    const longContent = 'refund policy details. '.repeat(2000); // ~48000 chars, way over budget
    const docs: KnowledgeDoc[] = [
      { id: 'a', title: 'Doc A', category: null, content: longContent, sourceFile: null, sourcePage: null, rank: 0.9 },
      { id: 'b', title: 'Doc B', category: null, content: longContent, sourceFile: null, sourcePage: null, rank: 0.6 },
      { id: 'c', title: 'Doc C', category: null, content: longContent, sourceFile: null, sourcePage: null, rank: 0.3 },
      { id: 'd', title: 'Doc D', category: null, content: longContent, sourceFile: null, sourcePage: null, rank: 0.1 },
      { id: 'e', title: 'Doc E', category: null, content: longContent, sourceFile: null, sourcePage: null, rank: 0.05 },
    ];

    const service = new RagService(fakeKnowledgeRepo(docs), fakeEmbeddingsClient());
    const result = await service.retrieveContext('refund policy', 1200);

    expect(estimateTokens(result.contextText)).toBeLessThanOrEqual(1200);
  });

  it('gives higher-ranked docs a larger share of the excerpt budget', async () => {
    const longContent = 'x'.repeat(20000);
    const docs: KnowledgeDoc[] = [
      { id: 'high', title: 'High Rank', category: null, content: longContent, sourceFile: null, sourcePage: null, rank: 0.9 },
      { id: 'low', title: 'Low Rank', category: null, content: longContent, sourceFile: null, sourcePage: null, rank: 0.1 },
    ];

    const service = new RagService(fakeKnowledgeRepo(docs), fakeEmbeddingsClient());
    const result = await service.retrieveContext('x', 1200);

    const highSection = result.contextText.split('### Low Rank')[0] ?? '';
    const lowSectionIndex = result.contextText.indexOf('### Low Rank');
    const lowSection = lowSectionIndex === -1 ? '' : result.contextText.slice(lowSectionIndex);

    expect(highSection.length).toBeGreaterThan(lowSection.length);
  });
});
