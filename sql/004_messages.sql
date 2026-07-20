create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  message text not null,
  tokens int,
  instagram_message_id text,
  created_at timestamptz not null default now()
);

-- Covers "last N messages for a conversation ordered by created_at" (prompt
-- construction) and the message-count-threshold check for summarization.
create index if not exists idx_messages_conversation_id_created_at
  on messages(conversation_id, created_at);

-- Denormalized counter on conversations.message_count, maintained by trigger,
-- so checking the 50-message summarization threshold is O(1) instead of a
-- count(*) query on every inbound message.
create or replace function increment_conversation_message_count()
returns trigger
language plpgsql
as $$
begin
  update conversations
  set message_count = message_count + 1,
      updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_messages_increment_count on messages;
create trigger trg_messages_increment_count
  after insert on messages
  for each row
  execute function increment_conversation_message_count();
