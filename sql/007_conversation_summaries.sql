-- Separate table (not a column on conversations) so the hot "get active
-- conversation" row stays narrow, and so summary history is preserved across
-- re-summarizations for debugging/audit rather than destructively overwritten.
create table if not exists conversation_summaries (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  summary text not null,
  message_count_at_summary int not null,
  created_at timestamptz not null default now()
);

-- Fetch the latest summary for a conversation fast.
create index if not exists idx_conversation_summaries_conversation_id_created_at
  on conversation_summaries(conversation_id, created_at desc);
