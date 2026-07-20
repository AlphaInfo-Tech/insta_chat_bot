# API Reference

## `GET /api/webhook`

Meta's webhook verification challenge. Called automatically when you save the
webhook subscription in the Meta App Dashboard.

**Query params** (sent by Meta):
| Param | Description |
|---|---|
| `hub.mode` | Always `subscribe` |
| `hub.verify_token` | Must match `META_VERIFY_TOKEN` |
| `hub.challenge` | Echoed back verbatim on success |

**Response**:
- `200` with the raw `hub.challenge` value as the body, if `hub.verify_token` matches.
- `403` otherwise.

## `POST /api/webhook`

Receives Instagram messaging events (messages, postbacks, reactions).

**Headers**:
| Header | Required | Description |
|---|---|---|
| `X-Hub-Signature-256` | Yes | `sha256=<hmac>` of the raw body, keyed by `META_APP_SECRET` |
| `Content-Type` | Yes | `application/json` |

**Body**: Meta's standard Instagram messaging webhook payload —
`{ object: "instagram", entry: [{ id, time, messaging: [...] }] }`.

**Response codes**:
| Code | Meaning |
|---|---|
| `200` | Always returned for successfully-authenticated, well-formed requests — including duplicates, rate-limited senders, and internal processing errors (Meta retries on non-200, so those cases still ack fast to avoid pointless retries). The actual chatbot reply is sent separately via the Instagram Send API, not in this response body. |
| `401` | Missing/invalid `X-Hub-Signature-256` |
| `400` | Body isn't valid JSON, or doesn't match the expected Instagram webhook schema |
| `500` | Server misconfigured (e.g. `META_APP_SECRET` not set) |

## `POST /api/admin/knowledge`

Ingests PDF/TXT knowledge source files into the `knowledge` table (one row
per page) for FTS retrieval. Not part of the public webhook surface — this is
an operator-only endpoint.

**Headers**:
| Header | Required | Description |
|---|---|---|
| `x-admin-api-key` | Yes | Must match `ADMIN_API_KEY` |

**Body**: `multipart/form-data`
| Field | Required | Description |
|---|---|---|
| `file` | Yes (1+) | One or more `.pdf`/`.txt` files. Repeat the field for multiple files. |
| `category` | No | Applied to every row created from this request; defaults to `"general"`. |

**Response** `200`:
```json
{
  "filesProcessed": 2,
  "rowsInserted": 14,
  "results": [
    { "filename": "faq.pdf", "pagesInserted": 12 },
    { "filename": "shipping.txt", "pagesInserted": 2 }
  ]
}
```

**Response codes**:
| Code | Meaning |
|---|---|
| `401` | Missing/invalid `x-admin-api-key` |
| `400` | Not multipart form data, or no `file` field present |

PDF pages are extracted as plain text (no OCR, no embeddings) via
`pdf-parse`. TXT files are split on form-feed (`\f`) characters if present,
otherwise treated as a single page. Re-uploading the same filename replaces
its existing rows (upsert on `source_file` + `source_page`) rather than
duplicating them.

## `GET /api/admin/knowledge`

Lists previously ingested source files, one row per file aggregated across
its pages. Backs the [`/admin/knowledge`](../app/admin/knowledge/page.tsx)
upload page.

**Headers**: same `x-admin-api-key` requirement as `POST`.

**Response** `200`:
```json
{
  "files": [
    { "sourceFile": "faq.pdf", "category": "support", "pageCount": 12, "uploadedAt": "2026-07-20T10:00:00Z" }
  ]
}
```

## `DELETE /api/admin/knowledge?file=<sourceFile>`

Deletes every row belonging to a source file (all of its ingested pages).

**Headers**: same `x-admin-api-key` requirement as `POST`.

**Response codes**:
| Code | Meaning |
|---|---|
| `200` | `{ "deleted": "<sourceFile>" }` |
| `400` | Missing `file` query parameter |
| `401` | Missing/invalid `x-admin-api-key` |

## `search_knowledge(query text, match_limit int default 5)` (Supabase RPC)

The SQL function backing all retrieval. Not exposed over HTTP directly, but
callable via `supabase.rpc('search_knowledge', { query, match_limit })` from
any Supabase client for debugging.

```sql
select * from search_knowledge('refund', 5);
```

Returns rows ranked by `ts_rank()` against `plainto_tsquery('english', query)`.
