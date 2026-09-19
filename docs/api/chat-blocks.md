# Chat Blocks API

Self-service block/unblock for 1:1 chat. Separate from admin-issued mute/ban
(`docs/api/admin-chat-moderation-restrictions.md`) — see
[`docs/technical/chat-user-blocking.md`](../technical/chat-user-blocking.md) for the
full design rationale. Consumed by the mobile app and admin web chat alike (session
cookie or bearer token).

Route files: `app/api/chat/blocks/route.ts`, `app/api/chat/blocks/[userId]/route.ts`.

---

## GET /api/chat/blocks

The caller's own block list.

- **Auth:** session cookie or bearer token
- **Response:** `200` `{ success: true, blocked: BlockedUserItem[] }` — each item has
  `userId`, `name`, `image`, `reason` (nullable), `createdAt`. Newest first.
- **Errors:** `401`, `500`.

```bash
curl "https://<host>/api/chat/blocks" -H "Authorization: Bearer <token>"
```

---

## POST /api/chat/blocks

Blocks a user. Idempotent (`ON CONFLICT DO NOTHING` on the `(blocker_id, blocked_id)`
primary key) — blocking an already-blocked user succeeds without creating a duplicate
row or erroring.

- **Auth:** session cookie or bearer token
- **Body:** `{ "userId": "string (required)", "reason": "string ≤500 (optional)" }`
- **Response:** `200` `{ success: true }`
- **Errors:**
  - `400` `Invalid input` (missing `userId`) / `Cannot block yourself`
  - `401` `Unauthorized`
  - `404` `User not found` (unknown or archived target)
  - `500` `Failed to block user`

**Effects, checked in both directions once either party has blocked the other:**

- `POST /api/chat/messages` returns `403` for either party sending to the other
  (`isBlockedEitherDirection()`).
- The conversation disappears from `GET /api/chat/conversations` and
  `GET /api/chat/unread/preview` for **both** parties (`getBlockedPeerIds()` filters
  it out of `features/chat/db/conversations-list.ts`'s two list queries).
- `GET /api/chat/history` is **not** affected — a block hides the conversation from the
  active list, it doesn't hide previously-exchanged messages from either party.
- Escrow-case threads are **not** affected — blocking is a flat-chat-only feature; see
  the technical doc for why.

```bash
curl -X POST "https://<host>/api/chat/blocks" \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"userId":"usr_123","reason":"harassment"}'
```

---

## DELETE /api/chat/blocks/[userId]

Lifts a block the caller previously issued.

- **Auth:** session cookie or bearer token
- **Response:** `200` `{ success: true }`
- **Errors:**
  - `401` `Unauthorized`
  - `404` `Block not found` — no active block from the caller against this user
  - `500` `Failed to unblock user`

```bash
curl -X DELETE "https://<host>/api/chat/blocks/usr_123" -H "Authorization: Bearer <token>"
```

---

**Mobile flag:** all three endpoints are consumed by the mobile app; response shapes
are frozen — additive changes only.
