export interface KnowledgeDoc {
  id: string;
  title: string;
  category: string | null;
  content: string;
  sourceFile: string | null;
  sourcePage: number | null;
  /** Present only on FTS search results (ts_rank score). */
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
}

/** One row per ingested source file, aggregated across its pages. */
export interface KnowledgeFileSummary {
  sourceFile: string;
  category: string | null;
  pageCount: number;
  uploadedAt: string;
}
