# Instagram AI Chatbot (RAG over PostgreSQL Full-Text Search)

A production-ready Instagram DM chatbot that answers customer questions using
Retrieval-Augmented Generation — **without embeddings or a vector database**.
Retrieval runs entirely on PostgreSQL Full-Text Search (`tsvector`, GIN index,
`plainto_tsquery`, `ts_rank`).

## Architecture

```
Instagram Graph Webhook
        │
        ▼
app/api/webhook/route.ts   (GET verify, POST signature+schema+rate-limit, dispatch)
        │
        ▼
services/webhook.service.ts   (orchestrator)
   │        │            │            │            │
   ▼        ▼            ▼            ▼            ▼
customer  conversation  message   rag.service   prompt.service
.service  .service      .service  (FTS search)  (assembles the prompt)
   │        │            │            │            │
   ▼        ▼            ▼            ▼            ▼
repositories/  (the only layer that touches Supabase)
   │
   ▼
Supabase PostgreSQL  (customers, conversations, messages, knowledge, ...)

lib/groq.ts        → Groq chat completions (RAG answers + summarization)
lib/instagram.ts   → Instagram Send API (outbound replies)
```

Repositories are the only files that talk to Supabase. Services depend on
repositories via constructor injection (not imports), which is also what
makes them unit-testable without mocking `@supabase/supabase-js` — tests just
pass in hand-built fake objects.

See [docs/API.md](docs/API.md), [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), and
[docs/TESTING.md](docs/TESTING.md) for details.

## Folder structure

```
app/api/webhook/route.ts        Instagram webhook (GET verify + POST events)
app/api/admin/knowledge/route.ts Admin endpoint to ingest PDF/TXT knowledge files
lib/                              External integrations: supabase, groq, instagram,
                                   pdfExtractor, verifySignature, webhookSchema, composition
services/                         Business logic (repository/lib clients injected)
repositories/                     Only layer touching Supabase
utils/                            logger, tokenCounter, retry, intent
prompts/systemPrompt.ts           RAG system prompt + fallback answer text
types/                            Shared TypeScript interfaces
database/types.ts                 Supabase generic Database type (mirrors sql/)
sql/                               Numbered migrations, run in order in Supabase
scripts/upload-knowledge.ts       CLI helper: batch-upload a local folder of PDFs/TXTs
```

## Quickstart

```bash
npm install
cp .env.example .env.local   # fill in real values (see docs/DEPLOYMENT.md)
```

Run `sql/001_extensions.sql` through `sql/010_updated_at_trigger.sql` in order
in the Supabase SQL editor (or via `psql`), then:

```bash
npm run dev
npm test
```

No real Meta App yet? Set `MOCK_INSTAGRAM=true` and run
`npm run webhook:mock -- --text="..."` to exercise the full webhook → RAG →
Groq pipeline locally with the outbound Instagram Send API call mocked out —
see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#4-smoke-test-locally-before-deploying).

## Design notes

- **No embeddings, no pgvector.** All retrieval is `plainto_tsquery()` +
  `ts_rank()` against a generated `tsvector` column, GIN-indexed. See
  [sql/005_knowledge.sql](sql/005_knowledge.sql) and
  [sql/006_knowledge_search_function.sql](sql/006_knowledge_search_function.sql).
- **Token budgets** are enforced per section: knowledge context ≤1200 tokens
  (excerpt-based, proportional to rank), conversation history ≤600 tokens
  (oldest messages dropped first), answer ≤250 tokens via Groq's `max_tokens`.
- **Intent detection** (`utils/intent.ts`) is pure rule-based matching —
  greetings/bye/thanks/emoji/acknowledgements get canned replies and never
  call Groq; only genuine business questions do.
- **Conversation memory**: every request loads the last 10 messages; once a
  conversation exceeds 50 messages, a Groq-generated summary is stored and
  used alongside (not instead of) the last 10.
- **Rate limiting** is a Supabase-backed fixed-window table
  (`rate_limits`), not in-memory — Vercel functions are stateless across
  invocations so in-memory counters don't work.
- **Idempotency**: Meta retries webhook deliveries; `processed_webhook_events`
  dedupes by `instagram_message_id` before any other work happens.
