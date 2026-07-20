# Deployment Guide

## 1. Create the Supabase project

1. Create a new project at [supabase.com](https://supabase.com).
2. In the SQL editor, run each file in `sql/` **in order**:
   `001_extensions.sql` → `002_customers.sql` → `003_conversations.sql` →
   `004_messages.sql` → `005_knowledge.sql` → `006_knowledge_search_function.sql`
   → `007_conversation_summaries.sql` → `008_rate_limits.sql` →
   `009_processed_webhook_events.sql` → `010_updated_at_trigger.sql`.
3. From **Project Settings → API**, copy the Project URL and the
   `service_role` key (not the `anon` key — this app runs entirely
   server-side and needs to bypass RLS).

## 2. Create the Meta App + Instagram messaging product

1. Create an app at [developers.facebook.com](https://developers.facebook.com).
2. Add the **Instagram** product and connect it to a Business/Creator
   Instagram account (via a connected Facebook Page).
3. Under **App Settings → Basic**, copy the **App Secret** → `META_APP_SECRET`.
4. Generate a Page Access Token with `instagram_manage_messages` permission →
   `META_PAGE_ACCESS_TOKEN`.
5. Choose your own value for `META_VERIFY_TOKEN` (any random string you
   pick) — you'll enter this in the next step.

## 3. Get a Groq API key

Create a key at [console.groq.com/keys](https://console.groq.com/keys) →
`GROQ_API_KEY`. Default model is `llama-3.3-70b-versatile`; check
[console.groq.com/docs/models](https://console.groq.com/docs/models) for
current Qwen/DeepSeek model ids if you want to switch `GROQ_MODEL`.

## 4. Smoke-test locally before deploying

Meta/Instagram is the most painful piece to set up (real Business account,
App Review, public HTTPS webhook), so validate everything else first —
Supabase, Groq, RAG retrieval, rate limiting, signature verification — with
the outbound Instagram Send API call mocked out.

1. Set `MOCK_INSTAGRAM=true` in `.env.local` (already the default in
   `.env.example`). This makes [lib/instagram.ts](../lib/instagram.ts)
   `sendMessage()` skip the real Graph API call and log the reply instead —
   no `META_PAGE_ACCESS_TOKEN` or real Meta App required. Everything else
   (Supabase reads/writes, the knowledge base / RAG lookup, Groq) still runs
   for real, identically to live mode.
2. `npm run dev`.
3. In another terminal, simulate an incoming DM:
   ```bash
   npm run webhook:mock -- --text="what's your refund policy"
   ```
   This signs a synthetic Instagram webhook payload with your local
   `META_APP_SECRET` and POSTs it to `http://localhost:3000/api/webhook` —
   see [scripts/mock-webhook.ts](../scripts/mock-webhook.ts).
4. Watch the `npm run dev` terminal for `webhook_*` / `groq_completion` /
   `instagram_send_mocked` log lines, and confirm new rows appear in
   Supabase's `customers`/`conversations`/`messages` tables.
5. Set `MOCK_INSTAGRAM=false` (or unset it) once you're ready to wire up a
   real Meta App and go live — this flag has no effect unless explicitly set
   to `"true"`.

## 5. Deploy to Vercel

1. Push this repo to GitHub/GitLab/Bitbucket and import it into Vercel, or
   run `vercel --prod` from the CLI.
2. In **Project Settings → Environment Variables**, set every variable from
   `.env.example`:
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `GROQ_MODEL`,
   `GROQ_SUMMARY_MODEL`, `META_APP_SECRET`, `META_VERIFY_TOKEN`,
   `META_PAGE_ACCESS_TOKEN`, `INSTAGRAM_GRAPH_API_VERSION`, `ADMIN_API_KEY`,
   `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_WINDOW_SECONDS`,
   `KNOWLEDGE_CONTEXT_MAX_TOKENS`, `CONVERSATION_HISTORY_MAX_TOKENS`,
   `ANSWER_MAX_TOKENS`, `SUMMARIZATION_THRESHOLD_MESSAGES`.
3. Deploy. Note your deployment URL, e.g. `https://your-app.vercel.app`.

`vercel.json` sets `maxDuration: 30` for the webhook route and `60` for the
admin knowledge route (PDF parsing can take longer). Adjust for your Vercel
plan if needed — Hobby plans cap function duration lower than Pro/Enterprise.

## 6. Configure the webhook subscription

1. In the Meta App Dashboard, under **Instagram → Webhooks**, set the
   **Callback URL** to `https://your-app.vercel.app/api/webhook` and the
   **Verify Token** to the same value as `META_VERIFY_TOKEN`.
2. Meta will immediately send a `GET` request to verify — it should succeed
   automatically if the env var matches.
3. Subscribe to the `messages` field (and `messaging_postbacks`,
   `message_reactions` if you want those handled too).

## 7. Add knowledge

**Option A — upload page.** Visit `https://your-app.vercel.app/admin/knowledge`,
enter your `ADMIN_API_KEY` (stored only in your browser's localStorage), then
drag in `.pdf`/`.txt` files and an optional category. The page lists every
previously ingested file (with page counts) and lets you delete one to remove
all of its rows. This page isn't behind its own auth beyond the admin key
prompt, so don't index it publicly or share the URL outside your team.

**Option B — CLI script.** Drop your `.pdf`/`.txt` source files into a local
`knowledge-source/` folder (gitignored) and run:

```bash
ADMIN_API_KEY=your-chosen-admin-api-key \
npm run knowledge:upload -- --url=https://your-app.vercel.app --category=faq
```

Both options POST to `/api/admin/knowledge`. See
[docs/API.md](API.md#post-apiadminknowledge) for the full endpoint contract
(including the `GET`/`DELETE` variants the upload page uses).

## 8. Verify end-to-end

1. **Webhook verification round-trip**: confirm the Meta Dashboard shows the
   webhook subscription as verified (green checkmark) — this already ran in
   step 6.
2. **Test DM**: send a message from a personal Instagram account to the
   connected business account. Check Vercel's function logs
   (`vercel logs` or the dashboard) for `webhook_*` / `groq_completion` /
   `instagram_send_success` log lines, and confirm you receive a reply.
3. **Rate limit trip**: send more than `RATE_LIMIT_MAX_REQUESTS` messages
   within `RATE_LIMIT_WINDOW_SECONDS` and confirm the logs show
   `webhook_rate_limited` without further Groq calls for the excess messages.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Webhook verification fails (403) | `META_VERIFY_TOKEN` in Vercel env doesn't match what you entered in the Meta Dashboard |
| `401` on every POST | `META_APP_SECRET` mismatch, or the request body was modified in transit (e.g. by a proxy) before signature verification |
| Bot never replies | Check `META_PAGE_ACCESS_TOKEN` validity/permissions, and confirm `instagram_send_success`/`instagram_send_failed` log lines |
| Replies say "I couldn't find that information..." for everything | No rows in `knowledge`, or `search_vector` isn't matching — run `select * from search_knowledge('your query')` directly in the Supabase SQL editor to debug |
| Admin upload returns 401 | `ADMIN_API_KEY` mismatch between the script's environment and the deployed app's env var |
