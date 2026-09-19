# Escrow Case Thread Rate Limiting

## What changed and why

`POST /api/admin/escrow-cases/[id]/messages` had no send-rate limit, unlike the flat
1:1 chat send path (`POST /api/chat/messages`), which has enforced a 30-messages/60s
DB-counted sliding window since its own rate-limit was added. An agent or supervisor
account (the only roles able to write to a case thread — see
`features/escrow-cases/lib/case-access.ts`) could otherwise script an unbounded burst
of case messages against one or many cases.

Files touched:

- `app/api/admin/escrow-cases/[id]/messages/route.ts` — added the rate-limit check,
  `maxDuration`, and a `jsonTimeout` helper, mirroring `app/api/chat/messages/route.ts`.
- `tests/api/escrow-cases/messages-rate-limit.test.ts` — new (429 and timeout cases).
- `tests/api/escrow-cases/messages.test.ts` — unaffected; existing `db.select` mocks
  already tolerate the extra call (see Edge cases below).

## Data flow

1. `requireEscrowThreadWriteAccess` resolves the caller's scope and rejects
   `"moderation"` (unchanged).
2. `getActiveRestriction(senderId)` — mute/ban check (unchanged, runs first).
3. **New:** `db.select({ count: sql\`count(*)::int\` }).from(escrowCaseMessage).where(and(eq(senderId, ...), gt(createdAt, windowStart)))`,
   wrapped in `withQueryTimeout(..., 6000, "escrow-case-send-rate-limit")`. If the count
   is `>= 30`, the route returns `429` before `sendEscrowCaseMessage` is ever called. If
   the query hangs past 6s, the route returns `503` with `Retry-After: 3` — the same
   fail-closed contract as the flat chat path (a timed-out count is never treated as "0
   sent so far", which would let a stalled connection bypass the limiter).
4. On success, the existing send flow (`sendEscrowCaseMessage`, broadcast, evidence
   recording, notification) runs unchanged.

## Schema impact

None. The count query runs against the existing `escrow_case_message.sender_id` /
`.created_at` columns, both already covered by `escrow_case_message_sender_idx` and
`escrow_case_message_case_created_idx` respectively (the sender-id index isn't
case-scoped, so the count is exact for a cross-case sliding window — see Edge cases).

## Auth & permissions

Unchanged — the rate limit applies uniformly to any caller that reaches the write
path (`admin`, `supervisor`, `own`-scope escrow agent). It runs after the access-scope
check and the mute/ban check, so a caller who fails either of those never reaches it.

## Edge cases & known limitations

- **Global per-sender, not per-case.** The window counts all of a sender's case
  messages across every case they can write to, not just the current case — matching
  the flat chat model's per-sender (not per-conversation) limit. A supervisor or admin
  legitimately covering many cases in quick succession could hit this; 30/60s was kept
  generous enough that this is unlikely in normal use, but if it becomes a real
  friction point, a per-(case, sender) window would be the fix (swap the `WHERE`
  clause to also filter `caseId`).
- **Existing test compatibility.** `tests/api/escrow-cases/messages.test.ts`'s existing
  POST tests mock `db.select` with `mockReturnValue` (not `mockReturnValueOnce`), so
  the same chain answers both the new rate-limit count query and the pre-existing
  sender-name lookup; the count query reads an `undefined` `.count` field from that
  chain's mock rows, which coerces to `0` via `?? 0` — safely under the limit. No
  existing test needed updating for this to keep passing.
