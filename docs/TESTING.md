# Testing Guide

```bash
npm test            # run once
npm run test:watch  # watch mode
npm run test:coverage
```

## Mocking strategy

Every repository and service takes its dependencies via **constructor
injection** (a `SupabaseClient`, another repository, a `GroqClient`, etc.),
not via module-level imports of singletons. This means tests almost never
need `vi.mock()`:

- **Repository tests** pass a hand-built fake Supabase client from
  [repositories/__testUtils__/mockSupabase.ts](../repositories/__testUtils__/mockSupabase.ts)
  — a minimal chainable object implementing just `.select()/.insert()/.eq()/
  .single()/.maybeSingle()/.rpc()`, configured with a fixed `{ data, error }`
  result per test.
- **Service tests** pass plain object literals cast to the repository/client
  interface (`{ searchByQuery: async () => [...] } as unknown as
  KnowledgeRepository`), using `vi.fn()` where you need to assert a call
  happened.
- Only [lib/groq.ts](../lib/groq.ts), [lib/instagram.ts](../lib/instagram.ts),
  and [lib/pdfExtractor.ts](../lib/pdfExtractor.ts) — the files that actually
  own an outbound `fetch`/third-party library call — would need real
  mocking (`vi.spyOn(global, 'fetch')` etc.) if you add tests for them
  directly; everything that *depends on* them is tested via the injected
  interface instead.

This is unit-test mocking (fake objects, no real I/O, no network). It's
separate from `MOCK_INSTAGRAM=true`, a **runtime** dry-run flag on
[lib/instagram.ts](../lib/instagram.ts) that skips the real Instagram Send
API call and logs the reply instead — every other layer (Supabase, Groq)
still runs for real. That's for manually smoke-testing the deployed-shaped
pipeline against `npm run dev` before you have a real Meta App, not for
`npm test`. See [docs/DEPLOYMENT.md](DEPLOYMENT.md#4-smoke-test-locally-before-deploying).

## Adding a new test

**Repository**: follow
[repositories/customer.repository.test.ts](../repositories/customer.repository.test.ts)
— construct `createMockSupabaseClient({ fromResult: { data, error } })`,
cast to `SupabaseClient<Database>`, assert the repository maps snake_case
rows to the camelCase domain type correctly.

**Service**: follow
[services/rag.service.test.ts](../services/rag.service.test.ts) or
[services/webhook.service.test.ts](../services/webhook.service.test.ts) —
build fake dependency objects with `vi.fn()` methods, construct the service,
assert both its return value and which dependency methods were (or weren't)
called.

**Pure util**: follow
[utils/intent.test.ts](../utils/intent.test.ts) — table-driven `it.each`
over input/expected-output pairs, no mocking needed at all.
