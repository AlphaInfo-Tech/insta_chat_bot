-- Single-row typed settings table (not key-value): the field set is small,
-- closed, and mixed-type (strings + numeric budgets), so a typed row keeps
-- numbers as numbers instead of reintroducing text-column parsing.
create table if not exists settings (
  id smallint primary key default 1 check (id = 1),
  agent_name text not null,
  company_name text not null,
  consult_cta text not null,
  whatsapp_cta text not null,
  fallback_answer text not null,
  knowledge_context_max_tokens int not null,
  conversation_history_max_tokens int not null,
  answer_max_tokens int not null,
  summarization_threshold_messages int not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_settings_updated_at on settings;
create trigger trg_settings_updated_at
  before update on settings
  for each row
  execute function set_updated_at();

-- Seeded with today's hardcoded prompts/systemPrompt.ts values so enabling
-- this table is a behavior-neutral deploy — nothing changes until an admin
-- edits a value via the dashboard.
insert into settings (
  id, agent_name, company_name, consult_cta, whatsapp_cta, fallback_answer,
  knowledge_context_max_tokens, conversation_history_max_tokens, answer_max_tokens, summarization_threshold_messages
)
values (
  1, 'Aria', 'Alpha Info Tech',
  'Would you like to book a free 30-minute consultation? I can connect you with our team right now.',
  'You can also reach us directly on WhatsApp: +91 99943 12900',
  $$That's a great question — let me connect you with someone from our team who can give you the exact answer.

You can reach us on WhatsApp at +91 99943 12900, or book a free 30-minute call at alphainfotech.org.

We typically respond within 2 hours.$$,
  1200, 600, 250, 50
)
on conflict (id) do nothing;
