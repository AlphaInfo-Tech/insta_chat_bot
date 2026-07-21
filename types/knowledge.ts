export interface KnowledgeDoc {
  id: string;
  title: string;
  category: string | null;
  content: string;
  sourceFile: string | null;
  sourcePage: number | null;
  /** Present only on vector search results (cosine similarity, 1 - distance). */
  rank?: number;
}

export interface CreateKnowledgeInput {
  title: string;
  category?: string | null;
  keywords?: string[];
  content: string;
}

export interface UpsertKnowledgePageInput extends CreateKnowledgeInput {
  sourceFile: string;
  sourcePage: number;
  embedding: number[];
}

/** One row per ingested source file, aggregated across its pages. */
export interface KnowledgeFileSummary {
  sourceFile: string;
  category: string | null;
  pageCount: number;
  uploadedAt: string;
}

export interface UpdateKnowledgeInput {
  title?: string;
  category?: string | null;
  keywords?: string[] | null;
  /** Changing content requires re-embedding — handled in KnowledgeIngestionService.updateRow, not the repository. */
  content?: string;
}
