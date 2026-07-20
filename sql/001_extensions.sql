-- Required for gen_random_uuid()
create extension if not exists pgcrypto;

-- Optional: enables trigram similarity, useful later for fuzzy title/category
-- matching. Not required by the FTS search path itself.
create extension if not exists pg_trgm;
