-- Primary idempotency mechanism for Instagram webhook delivery retries.
-- webhook.service.ts inserts on conflict do nothing before doing any other
-- work; no row returned means this instagram_message_id was already handled.
create table if not exists processed_webhook_events (
  id uuid primary key default gen_random_uuid(),
  instagram_message_id text not null unique,
  processed_at timestamptz not null default now()
);

-- Note: rows here grow unboundedly over time. A periodic cleanup job pruning
-- rows older than N days is a reasonable future addition but is not required
-- for correctness and is out of scope for v1.
