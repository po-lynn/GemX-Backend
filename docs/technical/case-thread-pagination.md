# Escrow Case Thread Pagination

## What changed and why

`listEscrowCaseMessages()` previously loaded an entire case thread in one query with no
limit — fine for short-lived cases, but unbounded as a case accumulates more messages
over its lifecycle (verification back-and-forth, side-channel notes, system events).
`GET /api/admin/escrow-cases/[id]/messages` now accepts `page`/`limit` query params,
mirroring the existing pagination contract on `GET /api/chat/history`.

Files touched:

- `features/escrow-cases/db/case-messages.ts` — `listEscrowCaseMessages()` signature
  and return shape changed (see below).
- `app/api/admin/escrow-cases/[id]/messages/route.ts` — GET handler parses `page`/
  `limit`, passes them through, returns `total`/`page`/`limit` alongside `messages`.
- `tests/api/escrow-cases/messages.test.ts` — updated existing GET assertions for the
  new call signature and return shape; added a page/limit forwarding test.

## Data flow

`listEscrowCaseMessages(caseId, includeSideChannel, { page, limit })` now:

1. Builds the same visibility-scoped `WHERE` clause as before.
2. Runs two sequential queries (not `Promise.all` — this route has no timeout wrapper
   of its own, so kept to one pooler connection at a time):
   - `ORDER BY createdAt DESC LIMIT limit OFFSET (page-1)*limit` for the page of rows.
   - `SELECT count(*)` under the same `WHERE` clause, for `total`.
3. Maps and **reverses** the DESC-ordered rows back to ascending order before
   returning, so page 1's response still reads oldest→newest, top-to-bottom — the
   same "query newest-first, reverse for display" trick `GET /api/chat/history` uses.
4. Returns `{ messages, total }` instead of a bare array.

The route's default is `page=1, limit=50` (max 200) — a change from "always load
everything." Most existing case threads are short enough that the default limit still
returns the full thread; only a case with more than 50 messages sees older messages
require an explicit `page=2` request.

## Schema impact

None — no new columns or indexes. The existing `escrow_case_message_case_created_idx`
(`caseId`, `createdAt`) already supports the ordered, offset-paginated query.

## Auth & permissions

Unchanged. Pagination applies identically across all four access scopes
(`admin`/`supervisor`/`own`/`moderation`) — `total` and the returned page both still
respect the same `includeSideChannel` visibility filter as before per scope.

## Edge cases & known limitations

- **Breaking change to the db-layer function's signature and return type** —
  `listEscrowCaseMessages` now requires a third `{ page, limit }` argument and returns
  `{ messages, total }` instead of `EscrowCaseMessageItem[]`. The only caller
  (`app/api/admin/escrow-cases/[id]/messages/route.ts`) was updated in the same change;
  any future caller must destructure the new shape.
- **The admin inbox UI (`EscrowCaseInboxPage.tsx`) is unchanged** — it calls the route
  with no query params, so it gets `page=1, limit=50` implicitly. It has no "load
  older messages" control today; wiring that up (calling `?page=2` on scroll, or
  switching to a "load more" button) is a follow-up UI task, not part of this backend
  change.
- **Offset pagination, not cursor-based** — acceptable here since case threads are
  bounded and rarely have concurrent inserts during a read; a cursor
  (`before: <messageId>`) would avoid the classic offset-pagination "shifted page"
  issue if that ever becomes a problem in practice.
