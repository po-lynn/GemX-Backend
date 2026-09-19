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
in-memory limiters) and returns **429** at ≥30. **Correction (2026-09-18): this
section previously said the count runs in `Promise.all` with the recipient-exists
check and "rides `chat_idx`" — both are now wrong; see the follow-up section
below for the current sequential/fail-closed shape and the dedicated index this
query actually needs.**

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

---

## Follow-up (2026-09-18): Connection-pool scalability pass

Prompted by a pre-launch scalability audit calibrated against the actual constraint —
Supabase's pooler on this project's tier caps at **15 backend connections total, shared
across the whole app**, not just chat (`drizzle/db.ts`). Six fixes, no API contract
changes except the SSE poll-interval range (documented in `docs/api/chat.md`).

### 1. SSE poll-interval floor raised: connection-pinning fix (BLOCKING finding)

**The bug:** `SSE_POLL_MIN_MS`/`SSE_POLL_DEFAULT_MS` were 2000/4000ms — both *shorter*
than the pooler's `idle_timeout` (10s, `drizzle/db.ts`). Since postgres-js only returns
an idle connection to the shared pool once it's actually been idle for `idle_timeout`,
a poll interval shorter than that meant the connection backing an open SSE stream never
went idle long enough to be released — it stayed reserved for the stream's entire life
(up to `SSE_MAX_LIFETIME_MS`, 4 minutes), not briefly borrowed per tick. Confirmed the
mobile client (`GemX-Mobile`) opens exactly this stream, at the default 4000ms interval,
whenever the Messages tab is focused — so as few as ~10-15 concurrently active mobile
users on that tab could have exhausted the entire pool, breaking every other request in
the app project-wide, not just chat.

**The fix:** `SSE_POLL_MIN_MS`/`SSE_POLL_DEFAULT_MS` raised to **15000ms** (`~5s` margin
over the 10s `idle_timeout`), `SSE_POLL_MAX_MS` unchanged at 30000ms
(`app/api/chat/conversations/route.ts`). `clampPollIntervalMs` applies this floor to
*any* client-requested `intervalMs`, including a value below it — so a client hardcoding
the old default (like the mobile app's `intervalMs=4000`) is silently clamped up to
15000ms server-side, with **no mobile-side change required** for this specific fix to
take effect. Also added `maxDuration = 260` (previously unset, unlike every sibling
route), a platform backstop above `SSE_MAX_LIFETIME_MS`.

**Still recommended (see `docs/MOBILE-API.md`):** the mobile client should stop opening
`?stream=1` for the inbox at all and instead trigger a plain `GET /api/chat/conversations`
refetch off the Supabase Broadcast events it already subscribes to — this needs no held
connection whatsoever and is fresher than any polling interval. The floor above is the
safety net that makes the backend survive regardless of whether/when that ships.

### 2. Send-rate-limit count queries: added dedicated indexes (BLOCKING finding)

**The bug:** `POST /api/chat/messages`'s rate-limit count
(`sender_id = ? AND created_at > windowStart`) has no `recipient_id` predicate, so
`chat_idx (sender_id, recipient_id, created_at DESC)` can't use `created_at` as an index
range (btree leftmost-prefix rules require `recipient_id` to be equality-bound first) —
Postgres applies `sender_id = ?` as the index condition and `created_at > windowStart` as
a post-scan filter, visiting every message that sender has *ever* sent, on every single
send. Same shape on `POST /api/admin/escrow-cases/[id]/messages` against
`escrow_case_message`, whose only sender index had no `created_at` column at all.

**The fix:** two new dedicated indexes — `messages_sender_created_at_idx
(sender_id, created_at)` and `escrow_case_message_sender_created_at_idx
(sender_id, created_at)` (`drizzle/schema/chat-schema.ts`,
`drizzle/schema/escrow-case-schema.ts`, migration `0103_workable_beast.sql`) — kept
separate from `chatIdx`/`escrow_case_message_sender_idx` rather than reordering them,
since those serve different access patterns. `chat-schema.ts`'s comment claiming
`chatIdx` already covered rate-limit counting was corrected.

### 3. Chat search: halved query cost + added rate limiting (WORTH-FIXING finding)

`features/chat/db/message-search.ts` previously ran the full participant+FTS predicate
**twice** per request — once for the page of rows, once again for the exact total. Now
uses `count(*) OVER()` to get both in one round trip. Trade-off: a `page` requested past
the last page returns 0 rows (OFFSET removes them before the window function can be
read), so `total` comes back `0` instead of the true count for that specific edge case —
accepted, since `total` exists to drive "is there a next page," not to be authoritative
for an out-of-range page number.

`GET /api/chat/search` also had no rate limiting at all, unlike both send paths. Added
an in-memory limiter (`lib/rate-limit.ts`, 20 searches/60s per user) rather than a
DB-counted one — a DB round trip purely to rate-limit a query we're trying to make
*cheaper* would be self-defeating, and a per-instance-only soft cap is an accepted
trade-off for a read endpoint.

### 4. Fire-and-forget push/broadcast now use `after()`, not bare `void`/`catch`

`POST /api/chat/messages` and `POST /api/admin/escrow-cases/[id]/messages` dispatched
their post-response push notification and Realtime broadcast with `void promise.catch()`
— if the runtime freezes the invocation immediately after the response streams, that
work (including its own DB reads/writes) could be abandoned mid-flight. Both routes now
wrap these in `after()` (the pattern already used correctly in
`features/articles/actions/articles.ts`), which keeps the invocation alive until the
work actually finishes.

### 5. Broadcast helpers now check the response status

`lib/supabase/chat-broadcast.ts` and `lib/supabase/case-broadcast.ts` called `fetch()`
against Supabase Realtime with no `res.ok` check — `fetch()` only rejects on a
network-level failure, so a non-2xx response (rotated service-role key, rate limiting,
a Supabase-side outage) resolved normally and was silently indistinguishable from
"recipient was offline." Both now throw on a non-ok response, which the existing
`.catch(...)` call sites already log.

### 6. Admin oversight query: restored sequential-await discipline

`getConversationMessagesForAdmin` (`features/chat/db/admin-all-conversations.ts`) ran
its rows and count queries via `Promise.all`, the only place in the audited chat/
escrow-case surface that didn't follow this codebase's otherwise-consistent
"sequential, not `Promise.all`" rule for holding at most one pooler connection per
request at a time. Low urgency (admin-only, bounded by staff headcount), fixed for
consistency with every sibling query pair.

### Deliberately deferred (not done in this pass)

- **Conversation-list query scaling with a user's total message history, not their
  conversation count** — `getChatConversationsForUser`'s `DISTINCT ON` groups by a
  computed `peerId` that no index can back, so cost scales with lifetime message volume.
  This is the conversation-summary-table refactor already flagged as deferred in the
  original 2026-07-05 review above — still correctly deferred; not urgent at current
  data volumes, but will need a denormalized table with lead time before high-volume
  sellers' histories grow into the thousands.
- FTS search's 2-character minimum and offset-based deep pagination — infrequent,
  user-initiated action; revisit only if evidence of heavy interactive search emerges.
- Reconnect resync only covers the conversation list / unread counts, not an
  already-open thread's messages (`ChatDashboard.tsx`) — a real correctness gap, not
  a scale one; out of scope for this pass.

### Tests

- `tests/api/chat/conversations.test.ts` — `clampPollIntervalMs` floor/ceiling/default,
  JSON-mode happy path, SSE content-type switch.
- `tests/api/escrow-cases/messages-rate-limit.test.ts` — 429 and fail-closed 503 for the
  case-thread send rate limit.
- `tests/unit/chat-message-search-query.test.ts` — single-query rows+total via
  `count(*) OVER()`, including the over-paginated-page edge case.
- `tests/api/chat/search.test.ts` — added rate-limit test.
- `tests/unit/chat-broadcast-response-check.test.ts` — non-ok broadcast response throws.
- `tests/unit/admin-all-conversations-query.test.ts` — updated comment for the
  sequential-await fix (behavior unchanged, call count/order unchanged).
