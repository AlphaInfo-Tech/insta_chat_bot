-- Single-round-trip RPC used by knowledge.repository.ts's searchByQuery().
-- Ranking logic lives here in one place so it's easy to tune (e.g. weighting)
-- without touching application code.
create or replace function search_knowledge(query text, match_limit int default 5)
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
    ts_rank(k.search_vector, plainto_tsquery('english', query)) as rank
  from knowledge k
  where k.search_vector @@ plainto_tsquery('english', query)
  order by rank desc
  limit match_limit;
$$;
