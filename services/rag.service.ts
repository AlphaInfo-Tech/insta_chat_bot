import type { KnowledgeRepository } from '@/repositories/knowledge.repository';
import type { EmbeddingsClient } from '@/lib/embeddings';
import type { KnowledgeDoc } from '@/types/knowledge';
import { estimateTokens } from '@/utils/tokenCounter';
import { logger } from '@/utils/logger';

const TOP_K = 5;
const KNOWLEDGE_CONTEXT_MAX_TOKENS = Number(process.env.KNOWLEDGE_CONTEXT_MAX_TOKENS ?? 1200);
const MIN_TOKENS_PER_DOC = 50;

export interface RagContext {
  docs: KnowledgeDoc[];
  contextText: string;
  tokenCount: number;
}

/** Extracts a window of `content` centered on the earliest matched query term, falling back to the opening paragraph if no term matches. */
function extractExcerpt(content: string, query: string, maxChars: number): string {
  if (content.length <= maxChars) return content;

  const lowerContent = content.toLowerCase();
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  let matchIndex = -1;
  for (const word of words) {
    const idx = lowerContent.indexOf(word);
    if (idx !== -1 && (matchIndex === -1 || idx < matchIndex)) matchIndex = idx;
  }

  if (matchIndex === -1) return content.slice(0, maxChars);

  const halfWindow = Math.floor(maxChars / 2);
  const start = Math.max(0, matchIndex - halfWindow);
  return content.slice(start, start + maxChars);
}

export class RagService {
  constructor(
    private readonly knowledgeRepo: KnowledgeRepository,
    private readonly embeddingsClient: EmbeddingsClient,
  ) {}

  /**
   * Retrieves the top-5 semantic matches and merges them into one Context
   * section, using excerpt-based truncation (proportional to rank) to stay
   * within the knowledge-context token budget rather than dropping whole
   * documents.
   */
  async retrieveContext(userQuestion: string): Promise<RagContext> {
    const queryEmbedding = await this.embeddingsClient.embed(userQuestion);
    const docs = await this.knowledgeRepo.searchByEmbedding(queryEmbedding, TOP_K);

    if (docs.length === 0) {
      logger.info('rag_search', { query: userQuestion, resultCount: 0 });
      return { docs: [], contextText: '', tokenCount: 0 };
    }

    const sorted = [...docs].sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));
    const totalRank = sorted.reduce((sum, d) => sum + (d.rank ?? 0), 0);

    let remainingBudget = KNOWLEDGE_CONTEXT_MAX_TOKENS;
    const sections: string[] = [];
    const includedDocs: KnowledgeDoc[] = [];

    for (const doc of sorted) {
      if (remainingBudget < MIN_TOKENS_PER_DOC) break;

      const share = totalRank > 0 ? (doc.rank ?? 0) / totalRank : 1 / sorted.length;
      const tokenBudget = Math.min(
        remainingBudget,
        Math.max(MIN_TOKENS_PER_DOC, Math.floor(KNOWLEDGE_CONTEXT_MAX_TOKENS * share)),
      );

      const excerpt = extractExcerpt(doc.content, userQuestion, tokenBudget * 4);
      const section = `### ${doc.title}\n${excerpt}`;

      sections.push(section);
      includedDocs.push(doc);
      remainingBudget -= estimateTokens(section);
    }

    const contextText = sections.join('\n\n');
    const tokenCount = estimateTokens(contextText);

    logger.info('rag_search', {
      query: userQuestion,
      retrievedDocIds: docs.map((d) => d.id),
      ranks: docs.map((d) => d.rank),
      includedDocIds: includedDocs.map((d) => d.id),
      contextTokens: tokenCount,
    });

    return { docs: includedDocs, contextText, tokenCount };
  }
}
