# Guide: Chat Conversations List Query

How the chat conversations list (`GET /api/chat/conversations`) is built, how to
extend it, and the one PostgreSQL pitfall you must not reintroduce.

## Prerequisites

- `DATABASE_URL` in `.env.local` (Supabase pooled connection)
- No extra dependencies — uses existing Drizzle + `postgres` client

## How It Works

`features/chat/db/conversations-list.ts` exposes:

```ts
import { getChatConversationsForUser } from "@/features/chat/db/conversations-list";

const items = await getChatConversationsForUser(session.user.id);
// → ChatConversationListItem[]: one entry per chat peer, newest thread first
```

Each item carries the peer's profile, a human-readable preview of the last
message (`"Sent photos"` / `"Voice message"` / `"Sent a file"` fallbacks),
unread count, and an `isOnline` flag derived from session presence.

Under the hood it runs 3 round-trips per call (latest-per-peer, profiles +
unread, presence). The latest-per-peer query uses PostgreSQL `DISTINCT ON`
over a subquery-computed `peerId` column.

The same module exports `getChatActivitySignature(userId)` — a one-query change
fingerprint (max created_at, max edited_at, total, unread) used by the SSE
stream in `app/api/chat/conversations/route.ts` to skip the full pipeline on
quiet ticks. If you add data to the stream payload that can change *without*
touching the `messages` table, either fold it into the signature or rely on the
30s presence refresh (`SSE_PRESENCE_REFRESH_MS`) — otherwise updates will lag.

Supporting indexes (migration `0065`): `chat_idx (sender_id, recipient_id,
created_at DESC)`, `recipient_chat_idx (recipient_id, sender_id, created_at
DESC)`, and partial `unread_by_recipient_idx (...) WHERE is_read = false`.
Keep new chat queries aligned with these shapes (lead with sender_id or
recipient_id).

Related behaviors added alongside:
- **Send rate limit** — `POST /api/chat/messages` returns `429` beyond
  30 messages/60s per sender; clients should surface a "slow down" toast.
- **Reconnect resync** — subscribe to `onResubscribe` on the realtime service
  and refetch server state there; Broadcast events during a disconnect are lost.

## ⚠️ The DISTINCT ON Pitfall (do not reintroduce)

PostgreSQL requires the `DISTINCT ON` expression to be **structurally identical**
to the first `ORDER BY` expression. Drizzle's `sql` template converts every
`${value}` interpolation into a **new** bind placeholder, so writing the same
`CASE WHEN x = ${userId} ...` in both clauses renders as `$1` in one and `$5`
in the other — Postgres rejects that with error `42P10` at parse time, and
nothing short of a real Postgres round-trip catches it.

**Rule:** compute the expression once as a named column in a subquery, then
reference the column:

```sql
SELECT DISTINCT ON (t."peerId") t.*
FROM ( SELECT ..., CASE WHEN ... = ${userId} ... END AS "peerId" FROM ... ) t
ORDER BY t."peerId", t."createdAt" DESC
```

The regression test `tests/unit/chat-conversations-list-query.test.ts` enforces
this invariant — it renders the query with `PgDialect.sqlToQuery` and asserts
the `DISTINCT ON` expression equals the leading `ORDER BY` expression verbatim.
If you edit the query and that test fails, you have reintroduced the bug.

## How to Extend

### Add a field to each conversation item

1. Add the column to the **inner** subquery select list (alias it in camelCase,
   e.g. `m.reply_to AS "replyTo"`).
2. Add it to the `LatestSqlRow` type.
3. Map it in the `items` construction and extend `ChatConversationListItem`.
4. Update the regression test only if you changed `DISTINCT ON`/`ORDER BY`.

### Change the "latest message" tiebreaker

Append a secondary key **after** `t."createdAt" DESC` in the outer `ORDER BY`
(e.g. `t."id" DESC`). Never touch the first key — it must stay `t."peerId"`.

## Common Errors

| Symptom | Cause | Fix |
|---|---|---|
| `42P10: SELECT DISTINCT ON expressions must match initial ORDER BY expressions` | Parameterized expression repeated across `DISTINCT ON` and `ORDER BY` | Hoist into a subquery column (see pitfall above) |
| New field is `undefined` on items | Added to subquery but not to `t.*` mapping / `LatestSqlRow` | Update the row type and mapping |
| Unit tests pass but the route 500s | The query only fails inside Postgres | Test the rendered SQL against a real Postgres (`PREPARE q(text,...) AS <query>; EXECUTE q(...)`) |
