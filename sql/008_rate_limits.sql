-- Fixed-window rate limiting (chosen over sliding window for simplicity —
-- acceptable boundary-burst tolerance for an abuse-guard, not billing-critical).
create table if not exists rate_limits (
  id uuid primary key default gen_random_uuid(),
  rate_key text not null,
  window_start timestamptz not null,
  request_count int not null default 1,
  created_at timestamptz not null default now(),
  -- Makes the check-and-increment atomic/race-safe via a single upsert, which
  -- matters because Vercel serverless functions are stateless across
  -- invocations and concurrent requests from the same sender can land on
  -- different instances.
  unique (rate_key, window_start)
);

create index if not exists idx_rate_limits_rate_key
  on rate_limits(rate_key, window_start desc);

-- supabase-js's upsert() can only set fixed literal values, not expressions
-- referencing the existing row (request_count + 1), so the atomic increment
-- is exposed as an RPC instead — same reasoning as search_knowledge().
create or replace function increment_rate_limit(p_rate_key text, p_window_start timestamptz)
returns setof rate_limits
language sql
as $$
  insert into rate_limits (rate_key, window_start, request_count)
  values (p_rate_key, p_window_start, 1)
  on conflict (rate_key, window_start)
  do update set request_count = rate_limits.request_count + 1
  returning *;
$$;
