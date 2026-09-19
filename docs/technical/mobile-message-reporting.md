# Mobile Message Reporting

## What changed and why

`message_report` (`drizzle/schema/chat-moderation-schema.ts`) already existed, but the
only way to create a row was `POST /api/admin/chat-moderation/reports` — staff filing a
report while reviewing a thread. There was no end-user-facing "report this message"
action, despite the UI implication of one (and an explicit `OPEN_QUESTIONS.md` note
flagging it as out of scope for that earlier task). This adds the missing mobile/web
endpoint, scoped to flat 1:1 chat messages only (escrow-case threads have no
buyer/seller-facing surface at all today — see `features/escrow-cases/lib/case-access.ts`
— so there's nothing for an end user to report there).

Files touched:

- `app/api/chat/messages/[messageId]/report/route.ts` — new.
- `tests/api/chat/messages-report.test.ts` — new.

## Data flow

1. Session auth (`auth.api.getSession`) — same as every other `/api/chat/*` route.
2. Body validated: `{ reason: string, 1–1000 chars }`.
3. The target message is loaded from `messages` by id. **The reporter must be the
   message's sender or recipient** — anyone else gets the same `404` a nonexistent
   message id would, so message ids can't be probed for existence by non-participants.
4. **Idempotency check:** if this reporter already has an `open` or `actioned` report
   against the same `flatMessageId`, that existing report is returned
   (`alreadyReported: true`) instead of inserting a duplicate — guards against a
   double-tapped "report" button creating multiple rows.
5. `createMessageReport()` (`features/chat-moderation/db/reports.ts`, unchanged,
   already supported this shape) inserts the row. `contentSnapshot` is taken from the
   message row read in step 3 — **never** trusted from the request body — since a flat
   message can later be hard-deleted, and the report's `contentSnapshot` is its only
   surviving record of what was actually said.
6. The new row lands in the existing admin reports queue
   (`GET /api/admin/chat-moderation/reports`) exactly like a staff-filed one; nothing
   downstream needed to change.

## Schema impact

None. `message_report.reporterId` already accepted any user id (there was no
CHECK/role constraint restricting it to staff) — the schema comment describing it as
"today, always the moderator/staff session filing it" was a statement about the only
caller that existed, not an enforced constraint. This change is purely additive at the
API layer.

## Auth & permissions

Session-authenticated (mobile bearer token or admin web session cookie) — any
authenticated user may file a report, gated only by the participant check in step 3
above. No admin/staff/feature-key check, unlike every other chat-moderation endpoint —
this is deliberately the one moderation-adjacent surface an ordinary user can reach.

## Edge cases & known limitations

- **Sender can report their own sent message too** — not restricted to the recipient.
  Useful if a message was sent in error, or the thread turned abusive from both sides;
  there was no reason implied by the schema or existing admin flow to disallow it.
- **No rate limiting on report filing itself.** A malicious participant could still
  spam reports against different messages (the idempotency check only dedupes against
  the *same* message). Left out of scope for this change — if it becomes an abuse
  vector, the same DB-counted sliding-window pattern used for message sends
  (`docs/technical/escrow-case-rate-limiting.md`) would apply directly.
- **No push/email notification to admins on new report** — reports still surface only
  by staff polling `GET /api/admin/chat-moderation/reports`. Out of scope here; would
  be a natural follow-up alongside `docs/technical/chat-push-notifications.md`.
