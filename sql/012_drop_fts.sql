-- Full replace of Postgres FTS with pgvector similarity search (see
-- 011_vector_search.sql). Drops the tsvector column (and its GIN index,
-- dropped automatically with the column), the FTS search RPC, and its
-- helper function.
drop function if exists search_knowledge(text, int);
alter table knowledge drop column if exists search_vector;
drop function if exists knowledge_search_vector(text, text[], text);
