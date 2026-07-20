create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  instagram_id text not null unique,
  username text,
  created_at timestamptz not null default now()
);
