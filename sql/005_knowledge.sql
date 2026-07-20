-- to_tsvector('english', text) can't be used directly inside a GENERATED
-- ALWAYS AS column: the implicit text -> regconfig cast for the 'english'
-- literal is STABLE, not IMMUTABLE (regconfig names are resolved via a
-- catalog lookup that could in principle change), so Postgres rejects the
-- generation expression with "generation expression is not immutable".
-- Wrapping it in a SQL function explicitly declared IMMUTABLE works around
-- this: Postgres trusts the declared volatility at the call site rather than
-- re-analyzing the function body. Safe here since the config is always the
-- hardcoded literal 'english', never a variable.
create or replace function knowledge_search_vector(title text, keywords text[], content text)
returns tsvector
language sql
immutable
as $$
  select to_tsvector(
    'english',
    coalesce(title, '') || ' ' ||
    coalesce(array_to_string(keywords, ' '), '') || ' ' ||
    coalesce(content, '')
  );
$$;

create table if not exists knowledge (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  keywords text[],
  content text not null,
  -- Traceability for ingested PDF/TXT pages; null for manually-entered rows.
  source_file text,
  source_page int,
  search_vector tsvector generated always as (
    knowledge_search_vector(title, keywords, content)
  ) stored,
  created_at timestamptz not null default now()
);

create index if not exists idx_knowledge_search_vector on knowledge using gin(search_vector);
create index if not exists idx_knowledge_category on knowledge(category);

-- Enables idempotent re-ingestion: uploading the same file again replaces its
-- rows (upsert on this index) instead of duplicating them. A plain
-- (non-partial) unique index is required so supabase-js's upsert onConflict
-- target can match it directly — Postgres treats NULL as distinct per-row
-- anyway, so manually-entered rows (source_file/source_page both null) never
-- spuriously conflict with each other under this index.
create unique index if not exists idx_knowledge_source_file_page
  on knowledge(source_file, source_page);
