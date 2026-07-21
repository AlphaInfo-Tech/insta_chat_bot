# Instagram AI Chatbot (RAG over pgvector semantic search)

A production-ready Instagram DM chatbot that answers customer questions using
Retrieval-Augmented Generation, with **semantic vector search** via pgvector
— an extension inside the same Supabase Postgres already in use, so there's
still no separate vector database service to run. Embeddings are generated
by the built-in `gte-small` model running in a Supabase Edge Function
(`supabase/functions/generate-embedding`), so no third-party embeddings API
or key is required either.

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
customer  conversation  message   rag.service      prompt.service
.service  .service      .service  (pgvector search) (assembles the prompt)
   │        │            │            │            │
   ▼        ▼            ▼            ▼            ▼
repositories/  (the only layer that touches Supabase)
   │
   ▼
Supabase PostgreSQL  (customers, conversations, messages, knowledge, ...)
   │
   ▼
supabase/functions/generate-embedding  (gte-small, called by rag.service +
                                         knowledgeIngestion.service)

lib/groq.ts        → Groq chat completions (RAG answers + summarization)
lib/instagram.ts   → Instagram Send API (outbound replies)
lib/embeddings.ts  → Supabase Edge Function client (text → 384-dim vector)
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
                                   embeddings, pdfExtractor, verifySignature, webhookSchema,
                                   composition
supabase/functions/               Deno Edge Functions (generate-embedding: gte-small model)
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

Run `sql/001_extensions.sql` through `sql/012_drop_fts.sql` in order in the
Supabase SQL editor (or via `psql`), then deploy the embedding function:
`supabase functions deploy generate-embedding` (see
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)). Then:

```bash
npm run dev
npm test
```

No real Meta App yet? Set `MOCK_INSTAGRAM=true` and run
`npm run webhook:mock -- --text="..."` to exercise the full webhook → RAG →
Groq pipeline locally with the outbound Instagram Send API call mocked out —
see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#4-smoke-test-locally-before-deploying).

## Design notes

- **Semantic search via pgvector.** Every knowledge page and every incoming
  question is embedded (384-dim, `gte-small`, via the `generate-embedding`
  Edge Function) and matched by cosine similarity (`<=>`, HNSW-indexed) —
  see [sql/011_vector_search.sql](sql/011_vector_search.sql). This replaced
  an earlier PostgreSQL Full-Text Search implementation
  ([sql/012_drop_fts.sql](sql/012_drop_fts.sql)) because keyword-only
  matching missed paraphrased/loosely-worded customer questions.
- **Chunking**: every ingested page (PDF or TXT) is further split into
  ~50-word chunks (`KNOWLEDGE_CHUNK_WORDS`,
  `services/knowledgeIngestion.service.ts`) before embedding — keeps each
  chunk within the embedding model's context window and avoids diluting a
  page's embedding across unrelated content on the same page.
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
