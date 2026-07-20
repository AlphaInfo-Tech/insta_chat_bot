create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'closed')),
  message_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_conversations_customer_id on conversations(customer_id);

-- Fast lookup of "the active conversation" for a customer (the hot path on
-- every inbound webhook message).
create index if not exists idx_conversations_customer_active
  on conversations(customer_id)
  where status = 'active';
