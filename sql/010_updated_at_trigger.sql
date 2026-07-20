create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_conversations_updated_at on conversations;
create trigger trg_conversations_updated_at
  before update on conversations
  for each row
  execute function set_updated_at();
