create extension if not exists vector;

alter table knowledge add column embedding vector(384);

create index on knowledge using hnsw (embedding vector_cosine_ops);

-- Single-round-trip RPC used by knowledge.repository.ts's searchByEmbedding().
-- Returns 1 - cosine_distance aliased as `rank`, matching the "higher is
-- better" convention the old FTS search_knowledge() function used, so
-- rag.service.ts's budget-sharing logic needs no changes.
create or replace function match_knowledge(query_embedding vector(384), match_limit int default 5)
returns table (
  id uuid,
  title text,
  category text,
  content text,
  source_file text,
  source_page int,
  rank real
)
language sql
stable
as $$
  select
    k.id,
    k.title,
    k.category,
    k.content,
    k.source_file,
    k.source_page,
    (1 - (k.embedding <=> query_embedding))::real as rank
  from knowledge k
  where k.embedding is not null
  order by k.embedding <=> query_embedding
  limit match_limit;
$$;
