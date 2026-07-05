# Fix: Chat Conversations List — DISTINCT ON / ORDER BY Mismatch (42P10)

## What Changed

`GET /api/chat/conversations` failed in production with PostgreSQL error `42P10`:

```
SELECT DISTINCT ON expressions must match initial ORDER BY expressions
```

**Files touched:**

- `features/chat/db/conversations-list.ts` — rewrote the latest-message-per-peer query
- `tests/unit/chat-conversations-list-query.test.ts` — new regression tests

## Root Cause

The query (introduced in commit `404d433` "optimize code", replacing a `ROW_NUMBER()`
approach with `DISTINCT ON`) repeated the same `CASE` expression three times —
in `DISTINCT ON`, in the select list, and in `ORDER BY` — each time interpolating
`${currentUserId}` through Drizzle's `sql` template:

```sql
SELECT DISTINCT ON (CASE WHEN m.sender_id = ${currentUserId} THEN ... END)
  ...
ORDER BY CASE WHEN m.sender_id = ${currentUserId} THEN ... END, m.created_at DESC
```

Drizzle turns **every** `${...}` interpolation into a **new** bind placeholder.
The rendered SQL therefore contained `CASE WHEN m.sender_id = $1 ...` in
`DISTINCT ON` but `CASE WHEN m.sender_id = $5 ...` in `ORDER BY`. PostgreSQL
compares these expressions *structurally* at parse time
(`transformDistinctOnClause` in `parse_clause.c`) — `$1` and `$5` are different
expressions even though they bind identical values, so the query is rejected
before execution. This is why unit tests and typechecking never caught it:
the failure only exists inside the Postgres parser.

## The Fix

Compute `peerId` **once** in a subquery, then apply `DISTINCT ON` / `ORDER BY`
to that plain output column, which is immune to placeholder numbering:

```sql
SELECT DISTINCT ON (t."peerId") t.*
FROM (
  SELECT
    m.sender_id AS "senderId", ..., m.created_at AS "createdAt",
    CASE WHEN m.sender_id = $1 THEN m.recipient_id ELSE m.sender_id END AS "peerId"
  FROM messages m
  WHERE m.sender_id = $2 OR m.recipient_id = $3
) t
ORDER BY t."peerId", t."createdAt" DESC
```

Semantics are unchanged: one row per chat peer, carrying the most recent
message in that thread. The planner flattens the subquery, so the plan is
equivalent to the intended original.

## Data Flow

1. `app/api/chat/conversations` route → `getChatConversationsForUser(currentUserId)`
2. Query 1 (fixed here): latest message per peer via `DISTINCT ON` on the subquery-computed `peerId`
3. Query 2: peer profiles (`user` table, `inArray` on peer ids)
4. Query 3: unread counts grouped by sender
5. Query 4: presence maps (`getPresenceMapsForUserIds`)
6. Rows merged in JS → `ChatConversationListItem[]`, sorted by `lastMessageTime` desc

## Schema Impact

None. No Drizzle schema changes, no migration.

## Auth & Permissions

Unchanged — the route resolves `currentUserId` from the authenticated session/bearer
context before calling this query helper.

## Verification

- Regression test renders the query via `PgDialect.sqlToQuery` and asserts the
  `DISTINCT ON` expression is byte-identical to the leading `ORDER BY` expression.
  It failed against the old query (`$1` vs `$5`) and passes after the fix.
- Both query shapes were run against a real PostgreSQL instance using `PREPARE`
  (which uses `$n` placeholders exactly like the driver): the old shape reproduces
  the production `42P10` error; the fixed shape parses and returns one row per
  peer with the latest message winning.

## Edge Cases & Known Limitations

- Self-conversations (`sender_id = recipient_id = currentUserId`) yield
  `peerId = currentUserId`; unchanged from prior behavior.
- Ties on `created_at` within a peer resolve arbitrarily between the tied rows
  (no secondary tiebreaker such as message id) — same as before.
- **Rule of thumb for this codebase:** never repeat a parameterized expression
  that PostgreSQL must match structurally (`DISTINCT ON`, `GROUP BY` vs window
  frames, etc.) via multiple `${...}` interpolations in a Drizzle `sql` template.
  Hoist the expression into a subquery column instead.
