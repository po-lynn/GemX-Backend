# Core Messaging Release — Design

## Motivation

GemX has two independent messaging systems: a flat 1:1 `messages` table
(buyer↔seller DMs, no conversation entity) and a staff-only
`escrow_case`/`escrow_case_message` system with visibility tiers, used
entirely within the admin panel. Buyers/sellers never see the latter — what
they experience as "escrow chat" is actually a disguised regular DM to a
designated bot account (`escrow_service_setting.user_id`, surfaced via
`GET /api/mobile/escrow-chat-user`), indistinguishable in the data model
from any other conversation.

A large batch of chat hardening work (blocking, search, reporting, and a
connection-pool scalability pass) is already built and sitting uncommitted
in this repo (`git status`), triggered by a pre-launch scalability audit —
the SSE conversations stream's poll interval was shorter than the Postgres
pooler's idle timeout, so every open mobile stream pinned a connection for
its full life; ~10-15 concurrent users could exhaust the entire pool.

This spec scopes a "core messaging" release: ship that in-flight hardening,
and close the one structural gap in the brief — giving the mobile app (a
separate repo, `GemX-Mobile`, owned by another team — out of scope to build
here) a reliable, server-authoritative way to tell an escrow conversation
apart from a normal one, without touching the admin-only `escrow_case`
system or adding new delivery primitives.

## Goals

- Verify, test, document, and commit the already-built hardening batch:
  self-service blocking, chat search, end-user message reporting, and the
  SSE/rate-limit/broadcast scalability fixes.
- Add a computed `isEscrow` field to the two buyer/seller-facing chat read
  endpoints (`GET /api/chat/conversations`, `GET /api/chat/history`) so
  `GemX-Mobile` can render escrow threads distinctly, without any schema
  change or new table.
- Keep the release backend/admin-only: no work in `GemX-Mobile` itself
  beyond documenting the new field for that team to consume.

## Non-goals

- No changes to `escrow_case` / `escrow_case_message`. That system stays
  admin/staff-only exactly as it is today — this release does not expose
  case threads, case status, or case visibility tiers to buyers/sellers.
- No new message delivery primitives. `messages.isRead` stays a single
  boolean; no distinct delivered-vs-read state, no typing indicators. Any
  WhatsApp/Telegram-parity work on that front is a future release.
- No mobile UI work. `GemX-Mobile` is a separate, separately-owned repo;
  this release's mobile-facing surface is the API contract only.
- No touching the unrelated uncommitted work in the same working tree
  (privacy-policy enum migration/journal-integrity fix) — different
  effort, not part of this release.

## Architecture

### Already-built hardening (verify + commit, no new design)

These are complete, uncommitted, and already have matching tests/docs per
the repo's post-change convention. This release's job is to confirm they're
correct and ship them, not redesign them:

| Feature | Key files | Migration |
|---|---|---|
| Self-service blocking | `drizzle/schema/chat-block-schema.ts`, `features/chat/db/blocks.ts`, `app/api/chat/blocks/` | `0101_open_mathemanic.sql` (`chat_block` table) |
| Chat search | `features/chat/db/message-search.ts`, `app/api/chat/search/` | `0102_chat_message_search_index.sql` (GIN FTS index) |
| Message reporting | `app/api/chat/messages/[messageId]/report/` | none (reuses existing moderation schema) |
| Rate-limit scale fix | `messages_sender_created_at_idx` / `escrow_case_message_sender_created_at_idx` | `0103_workable_beast.sql` |
| SSE poll floor fix | `features/chat/lib/sse-poll-interval.ts`, `app/api/chat/conversations/route.ts` | none |
| Broadcast fixes | `lib/supabase/chat-broadcast.ts`, `lib/supabase/case-broadcast.ts` | none |

Verification checklist before commit:
- `npm run test` passes in full (not just the touched suites)
- Each of the 3 pending migrations reviewed; **user applies them
  manually** (standing project rule — Claude does not run
  `db:generate`/`db:migrate`/`db:push`)
- `npm run lint` clean

### New: `isEscrow` conversation flag

The escrow bot account is not a static role — it's whatever
`escrow_service_setting.user_id` currently points to, resolved via
`getEscrowServiceChatUser()` (`features/escrow-service-settings/db/escrow-service-settings.ts`),
which reads the latest settings row with a non-null `user_id`. There is
exactly one current designated account at any time; it's an admin setting,
not a per-user flag.

Both read endpoints fetch that id once per request and stamp it onto their
existing response shape — no join needed, since it's a single id compared
against each row's peer id:

**`GET /api/chat/conversations`** (`features/chat/db/conversations-list.ts`,
`ChatConversationListItem`) — add:
```ts
isEscrow: boolean; // peerId === current escrow_service_setting.user_id
```

**`GET /api/chat/history`** (`app/api/chat/history/route.ts`) — the request
already takes `userId` (the peer) as a query param, so this is a single
comparison against the fetched escrow id, returned once at the top level of
the response (not per-message):
```ts
{ success: true, isEscrow: boolean, messages: [...] }
```

Fetch `getEscrowServiceChatUser()` once per request in both routes (it's
already a single indexed query, `orderBy(...).limit(1)`), compare the id,
no caching layer needed at this volume.

**Accepted limitation:** the flag reflects the *current* designated escrow
account. If admin reassigns `escrow_service_setting.user_id` to a different
user, older threads with the previous account stop being flagged as escrow.
This is acceptable for v1 — reassignment is rare and admin-only — but must
be written into the API doc as a known trade-off, not left implicit.

### Contract handoff to `GemX-Mobile`

This repo's deliverable to the mobile team is the documented field, not a
screen. `docs/api/chat.md` gets the `isEscrow` field documented on both
endpoints, including the reassignment caveat above, so the other team can
decide how to render the distinction (badge, separate inbox section,
whatever fits their UI) without needing to ask what the field means.

## Testing

- New unit test for the `isEscrow` computation (e.g.
  `tests/unit/chat-conversations-escrow-flag.test.ts`): flags the peer that
  matches the current setting, does not flag others, does not flag when
  `escrow_service_setting` has no configured row.
- New API test coverage on `GET /api/chat/conversations` and
  `GET /api/chat/history` asserting `isEscrow` appears correctly in the
  response shape.
- Existing uncommitted tests for blocking/search/reporting/rate-limiting
  reviewed and confirmed green as part of the same `npm run test` run —
  not rewritten, just verified.

## Documentation

Per this repo's post-change convention:
- `docs/api/chat.md` — document the new `isEscrow` field on both endpoints
  (already tracked as modified; extend rather than re-document from
  scratch), including the reassignment caveat.
- `docs/technical/chat-architecture-improvements.md` — already
  tracks the scalability work; add a short note on the `isEscrow` addition
  so the technical doc reflects the full shipped scope.
- No new collaborator guide needed — `isEscrow` is a small additive field
  on existing endpoints, not a new feature surface requiring a how-to.

## Rollout

1. Implement `isEscrow` on both endpoints + tests.
2. Run full test suite; fix any regressions surfaced across the whole
   uncommitted batch, not just the new field.
3. Update `docs/api/chat.md` and `docs/technical/chat-architecture-improvements.md`.
4. Commit (this release's scope only — leave the unrelated
   privacy-policy-enum work out of the commit).
5. Hand off: user applies the 3 pending migrations manually, then deploys.
6. Notify the `GemX-Mobile` team that `isEscrow` is available on both
   endpoints, pointing them at the updated `docs/api/chat.md`.
