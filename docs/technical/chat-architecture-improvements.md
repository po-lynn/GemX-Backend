# Chat Architecture Improvements — Indexes, Cheap SSE Ticks, Resync, Rate Limit

## What Changed

Follow-up to the chat architecture review (2026-07-05). Five improvements, no API
contract changes:

| Area | File(s) |
|---|---|
| Message indexes + `NOT NULL` | `drizzle/schema/chat-schema.ts`, `drizzle/migrations/0065_clever_diamondback.sql` |
| Cheap SSE change detection | `features/chat/db/conversations-list.ts` (`getChatActivitySignature`), `app/api/chat/conversations/route.ts` |
| Reconnect resync hook | `features/chat/realtime/messages-realtime-service.ts`, `features/chat/components/ChatDashboard.tsx` |
| Parallelized history queries | `app/api/chat/history/route.ts` |
| Send rate limit | `app/api/chat/messages/route.ts` |

## Schema Impact — migration `0065_clever_diamondback.sql`

Old shape:
- `is_read boolean DEFAULT false` (nullable), `starred boolean DEFAULT false` (nullable)
- one index: `chat_idx (sender_id, recipient_id)`

New shape:
- `is_read` / `starred` are `NOT NULL` (migration backfills `NULL → false` first —
  two past production bugs came from null-coalescing these columns)
- `chat_idx (sender_id, recipient_id, created_at DESC)` — history (outgoing half),
  latest-per-peer, rate-limit count
- `recipient_chat_idx (recipient_id, sender_id, created_at DESC)` — the recipient
  half of every `sender = me OR recipient = me` predicate, previously unindexed
- `unread_by_recipient_idx (recipient_id, sender_id) WHERE is_read = false` —
  partial; unread counts become index-only scans and the index stays tiny

Verified with `EXPLAIN` on a 10k-row local Postgres: signature query = BitmapOr
over `chat_idx` + `recipient_chat_idx`; unread counts = Index Only Scan on the
partial index; rate-limit count = `chat_idx` with `created_at` index condition.

**Deployment note:** migrations are applied manually (`npm run db:migrate` with
`DIRECT_URL`) per the project's intentional Vercel workflow. The migration was
validated end-to-end on a local Postgres including a legacy `NULL` row.

## Data Flow — SSE conversations stream (`?stream=1`)

Before: every tick (default 4s) ran the full pipeline — latest-per-peer
`DISTINCT ON`, profile fetch, unread group-by, presence aggregation (3 queries).

After: each tick first runs `getChatActivitySignature(userId)` — a single
index-backed aggregate returning `(max created_at, max edited_at, total count,
unread count)` serialized as the change fingerprint. The full pipeline runs only
when:
- the signature differs from the previous tick (new/edited/deleted message,
  read-state change), or
- `SSE_PRESENCE_REFRESH_MS` (30s) has elapsed — `isOnline` derives from session
  activity, which the signature cannot see.

Steady-state cost per tick drops from 3 queries (with sorts and joins) to 1 cheap
aggregate; the payload-diff (`lastJson`) suppression is unchanged, so clients see
identical stream behavior.

## Reconnect Resync

Supabase Broadcast is ephemeral: events published while a client's socket is down
are lost. `MessagesRealtimeHandlers` gains `onResubscribe?: () => void`, fired on
every `SUBSCRIBED` status (initial and reconnect), wrapped in try/catch.
`ChatDashboard` wires it to its existing debounced `scheduleUnreadSync()`, so a
reconnect reconciles unread counts with Postgres instead of trusting the gap.

## Send Rate Limit

`POST /api/chat/messages` now counts the sender's messages in the last 60s
(DB-counted sliding window — correct across serverless instances, unlike
in-memory limiters) and returns **429** at ≥30. The count runs in `Promise.all`
with the recipient-exists check, so the happy path gains no latency; the check
rides `chat_idx`.

## Auth & Permissions

Unchanged on all routes (session auth; sender/recipient scoping as before).

## Edge Cases & Known Limitations

- The signature can't observe presence changes — hence the forced 30s full
  refresh; worst-case presence staleness on the stream is 30s (window is 5 min).
- Rate limit counts *stored* messages: deleting messages frees budget. Acceptable
  for an anti-flood control, not a security boundary.
- The conversation-summary-table refactor (O(1) list reads, group-chat-ready) was
  deliberately **not** done — it's the next structural step if chat load grows.

## Tests

- `tests/unit/chat-conversations-list-query.test.ts` — DISTINCT ON invariant +
  signature contract (single query, param binding, fingerprint stability/change).
- `tests/unit/chat-realtime-resubscribe.test.ts` — resubscribe/error callbacks,
  handler-throw safety.
- `tests/api/chat/messages-rate-limit.test.ts` — 429 over limit (no insert),
  happy path under limit, 404 precedence, 401 gating.
