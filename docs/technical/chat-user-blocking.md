# Chat User Blocking

## What changed and why

Chat had no user-initiated way to stop hearing from someone — the only restriction
mechanism was admin-issued mute/ban (`messaging_restriction`,
`features/chat-moderation/db/restrictions.ts`), which requires a moderator to act. This
adds a self-service block: a user can block a peer, which (a) stops that peer's sends
in **either** direction and (b) drops the conversation out of both parties' active
conversation list.

Files touched:

- `drizzle/schema/chat-block-schema.ts` — new `chat_block` table.
- `drizzle/migrations/0101_open_mathemanic.sql` — generated migration (via
  `npm run db:generate`).
- `features/chat/db/blocks.ts` — new: `blockUser`, `unblockUser`,
  `isBlockedEitherDirection`, `getBlockedPeerIds`, `listBlockedUsers`.
- `app/api/chat/blocks/route.ts`, `app/api/chat/blocks/[userId]/route.ts` — new.
- `app/api/chat/messages/route.ts` — added the block check to the send path.
- `features/chat/db/conversations-list.ts` — both `getChatConversationsForUser` and
  `getUnreadConversationPreviews` filter out blocked peers.
- Tests: `tests/unit/chat-blocks-query.test.ts`, `tests/api/chat/blocks.test.ts`,
  `tests/api/chat/messages-block.test.ts`; updated
  `tests/unit/chat-unread-preview-query.test.ts` for the extra query.

## Data flow

**Blocking** (`POST /api/chat/blocks`): validates the target exists and isn't the
caller, then `INSERT ... ON CONFLICT DO NOTHING` into `chat_block` — idempotent, so
blocking an already-blocked user is a no-op rather than an error.

**Unblocking** (`DELETE /api/chat/blocks/[userId]`): deletes the caller's own
`(blockerId, blockedId)` row; `404` if no such row existed.

**Enforcement on send** (`POST /api/chat/messages`): after the mute/ban check,
`isBlockedEitherDirection(senderId, recipientId)` queries `chat_block` for a row in
*either* direction — `(senderId blocked recipientId)` OR `(recipientId blocked
senderId)` — and returns `403` if either exists. A block is recorded directionally
(who blocked whom, for the blocker's own unblock/list-view), but enforcement doesn't
care which side did the blocking.

**Filtering the conversation list** (`features/chat/db/conversations-list.ts`): both
`getChatConversationsForUser` and `getUnreadConversationPreviews` compute their normal
peer-id set from the raw message rows, then call `getBlockedPeerIds(currentUserId,
peerIds)` — one query resolving, for each block row touching the current user in
either direction, which side is "the peer" — and filter that set out **before** the
profile/unread/presence queries run (so a blocked peer's profile is never even looked
up).

## Schema impact

New table `chat_block`:

| Column       | Type      | Notes                                      |
|--------------|-----------|---------------------------------------------|
| `blocker_id` | text      | PK (composite), FK → `user.id`, `onDelete: cascade` |
| `blocked_id` | text      | PK (composite), FK → `user.id`, `onDelete: cascade` |
| `reason`     | text      | nullable                                     |
| `created_at` | timestamp | default now                                  |

Composite primary key `(blocker_id, blocked_id)` — one row per directed block pair,
naturally prevents duplicate blocks. Index `chat_block_blocked_idx` on `blocked_id`
supports the "am I blocked by this peer" direction of the enforcement lookup. Both FKs
cascade on delete — unlike `messaging_restriction` (which deliberately does *not*
cascade, since it's evidence of abuse), a block is an ordinary user preference with no
reason to survive either account's deletion.

## Auth & permissions

Session-authenticated (bearer or cookie), same as the rest of `/api/chat/*`. No
admin/staff involvement — this is entirely self-service. A user can only see and lift
their own blocks (`GET`/`DELETE` are always scoped to the caller's own `blockerId`).

## Edge cases & known limitations

- **Escrow-case threads are unaffected.** Blocking is flat-chat-only; a blocked pair
  who both happen to be buyer/seller on an active escrow case can still see and
  participate in that case's thread. This mirrors how `messaging_restriction` (mute/
  ban) is also flat-chat-scoped in the send path today — a future decision to extend
  either into case threads should treat them consistently.
- **`GET /api/chat/history` still works for a blocked pair.** Blocking hides the
  conversation from the *active* list; it does not retroactively hide or delete
  already-exchanged messages. This matches how most consumer chat apps treat blocking.
- **Directional row, bidirectional enforcement.** If A blocks B, only A's row exists,
  but B is equally unable to message A — B has no visibility into *why* (no "you've
  been blocked" signal is returned; B's send just gets a generic `403`), and B cannot
  unblock A (only A's own `DELETE` can remove A's row). This is the same asymmetry
  most blocking features have.
