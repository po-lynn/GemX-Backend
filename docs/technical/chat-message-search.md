# Chat Message Search

## What changed and why

There was no way to search message *content* — the closest existing feature,
`listEscrowCasesForViewer`'s admin search, explicitly covers only participant name and
listing title (`features/escrow-cases/db/escrow-cases.ts`'s own comment says as much).
This adds full-text search over a user's own flat 1:1 chat history, following the same
`to_tsvector`/`plainto_tsquery` pattern already established for product search
(`features/products/db/products.ts`, `0089_product_search_indexes.sql`). Scoped to flat
chat only — escrow-case threads have no buyer/seller-facing surface today (see
`features/escrow-cases/lib/case-access.ts`), so there is no end-user case-thread search
to add alongside it.

Files touched:

- `drizzle/migrations/0102_chat_message_search_index.sql` — new GIN index (hand-written,
  same reason 0089 was hand-written: an expression index on `to_tsvector` isn't
  representable in the Drizzle schema DSL, so it can't be `db:generate`d).
- `features/chat/db/message-search.ts` — new: `searchChatMessages`.
- `app/api/chat/search/route.ts` — new.
- Tests: `tests/unit/chat-message-search-query.test.ts`, `tests/api/chat/search.test.ts`.

## Data flow

`GET /api/chat/search?q=&peerId=&page=&limit=`:

1. Session auth, then `q` (2–200 chars, required) and optional `peerId`/`page`/`limit`
   validated by Zod (`querySchema`, `safeParse` — not `parseQuery`, since a missing/
   invalid `q` must surface as an explicit `400`, not silently fall back to a default).
2. `searchChatMessages(currentUserId, q, { peerId, page, limit })`:
   - Builds a participant clause: scoped to `(senderId = me OR recipientId = me)`, and
     if `peerId` is given, narrowed to just that pair.
   - Full-text match clause:
     ``to_tsvector('english', coalesce(content, '')) @@ plainto_tsquery('english', ${q})``
     — same expression as `messages_content_fts_idx`, so the planner can use it.
   - Runs the page query (`ORDER BY createdAt DESC LIMIT/OFFSET`) and a count query
     sequentially (not `Promise.all`, same one-pooler-connection-at-a-time rationale as
     `chat/history`).
   - Resolves each result row's `peerId` (whichever side of `senderId`/`recipientId`
     isn't the current user) and batch-fetches those peers' `name`/`image` in one query.
3. Wrapped in `withQueryTimeout(..., 6000, "chat-search")` — a hung search fails with
   `503`/`Retry-After: 3` rather than hanging the request.

## Schema impact

New index only, no new columns:

```sql
CREATE INDEX IF NOT EXISTS "messages_content_fts_idx"
ON "messages"
USING GIN (to_tsvector('english', coalesce("content", '')));
```

Not declared in `drizzle/schema/chat-schema.ts` — consistent with how the product
title/description FTS index is also absent from `product-schema.ts`; both are
maintained by hand in their migration files rather than through `db:generate`.

## Auth & permissions

Session-authenticated (bearer or cookie). Always scoped to the caller's own messages —
there is no way to search another user's conversations through this endpoint (that
would be the existing, separate admin oversight surface,
`GET /api/admin/messages/thread`, which has no search of its own yet).

## Edge cases & known limitations

- **Blocked peers are still searchable.** Consistent with `GET /api/chat/history`
  (see `docs/technical/chat-user-blocking.md`) — blocking hides a conversation from the
  active list, not from history or search.
- **English-only stemming.** `to_tsvector('english', ...)` is the same fixed
  configuration product search uses; a Burmese/Thai/Korean-heavy message body won't
  stem the way an English one does. Matches the existing product-search precedent
  rather than introducing a new multi-language search approach in this change.
- **No trigram/ILIKE fallback**, unlike product search (which combines FTS with ILIKE
  on `title` for partial-word matches on short titles). Message bodies are free-form
  prose, not short titles, so plain FTS was judged sufficient; add an ILIKE branch
  later if short/fragment queries prove too weak in practice.
- **`q` has a 2-character minimum** — a single-character search would match too broadly
  and cheaply defeat the point of ranking/limiting; callers needing "search-as-you-type"
  UX should debounce until `q.length >= 2` client-side.
