# Chat API

Consumed by the **mobile app** (bearer token) and the admin web chat (session
cookie). Better Auth resolves either from request headers.

---

## POST /api/chat/messages

Send one 1:1 message.

- **Auth:** session cookie or bearer token
- **Body** (`bodySchema` in `app/api/chat/messages/route.ts`):

```json
{
  "recipientId": "string (required)",
  "content": "string ≤5000 (optional)",
  "fileUrl": "url ≤2000 (optional)",
  "imageUrls": ["url", "... ≤12 (optional)"],
  "messageType": "text | image | audio | file (optional, inferred)",
  "tempId": "string ≤120 (optional, echoed back for optimistic UI)"
}
```

At least one of `content` / `fileUrl` / `imageUrls` is required.

- **Rate limit:** max **30 messages per 60s** per sender (DB-counted sliding window).
- **Responses:**
  - `200` `{ success: true, message: {...saved, tempId?} }`
  - `400` `Invalid input` / `Cannot send message to yourself`
  - `401` `Unauthorized`
  - `403` `You are banned from messaging: <reason>` / `You are muted from messaging until <ISO timestamp>: <reason>` — the sender has an active row in `messaging_restriction` (`getActiveRestriction()`, checked before the recipient/rate-limit checks; see `docs/technical/escrow-case-messaging.md`'s Step 6 section). Checked against the **sender** only, never the recipient — a muted/banned user can still receive messages, they just can't send any.
  - `403` `You can't message this user` — either party has blocked the other (`isBlockedEitherDirection()`, `features/chat/db/blocks.ts`; see [`docs/api/chat-blocks.md`](./chat-blocks.md)). Checked right after the restriction check, before the recipient/rate-limit queries.
  - `404` `Recipient not found` (unknown or archived)
  - `429` `Too many messages — please slow down`
  - `500` `Failed to send message`
  - `503` `{"error": "..."}` with `Retry-After: 3` — the recipient-exists check or the rate-limit count didn't complete within 6s. Both gate whether the send is allowed, so a timeout **fails closed** (503, message not sent) rather than silently letting the send through — never treated as "0 sent so far."
- **Side effects:** push notification to recipient; Supabase Broadcast
  `new_message` to `chat:<senderId>` and `chat:<recipientId>`.

```bash
curl -X POST https://<host>/api/chat/messages \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"recipientId":"usr_123","content":"hello"}'
```

---

## GET /api/chat/conversations

Conversation list: one row per peer with last message, unread count, presence.

- **Auth:** session cookie or bearer token
- **Query:**
  - `stream=1|true|sse` — switch to **Server-Sent Events**
  - `intervalMs` (SSE only) — poll cadence, clamped **15000–30000**, default **15000**. The
    floor is set by the DB connection pooler's idle timeout (see
    `docs/technical/chat-architecture-improvements.md`), not a UX choice — a shorter
    interval kept the pooled connection backing the stream from ever going idle long
    enough to be released, exhausting the whole app's connection pool at a handful of
    concurrently open streams. **A client requesting a lower value is silently clamped up
    to 15000 — this floor changed from 2000 to 15000; any client hardcoding a shorter
    value keeps working, just gets throttled server-side.**
- **JSON mode:** `200` `{ success: true, conversations: ChatConversationListItem[] }`
  — each item now also carries `isEscrow: boolean`: true when the peer is
  the account currently configured for escrow chat
  (`GET /api/mobile/escrow-chat-user`'s `user.id`). Use it to split this one
  list into a regular Buyer↔Seller inbox and a separate Escrow Chat screen —
  see `docs/MOBILE-API.md`.
- **SSE mode:** emits a `data:` line with the same payload whenever it changes,
  `: keep-alive` comments every 25s, closes after 4 min (client reconnects).
  Internally each tick runs a cheap change-detection aggregate and only executes
  the full pipeline on change or every 30s (presence refresh) — no client-visible
  behavior change.
- **Errors:** `401`, `500`.

```bash
curl -N "https://<host>/api/chat/conversations?stream=1" -H "Authorization: Bearer <token>"
```

---

## GET /api/chat/history

Paginated thread between the current user and `userId`.

- **Auth:** session cookie or bearer token
- **Query:** `userId` (required), `page` ≥1 (default 1), `limit` 1–100 (default 30)
- **Response:** `200`
  `{ messages: [...oldest→newest within page], participantImage, page, limit, total }`
- **Errors:**
  - `401`, `500`
  - `503` with `Retry-After: 3` — the messages page or total-count query (both primary — the total drives pagination) didn't complete within 6s. `participantImage` is secondary and never causes this: a slow peer-image lookup just falls back to `null` (no avatar shown) instead of failing the whole request.

```bash
curl "https://<host>/api/chat/history?userId=usr_123&page=1&limit=30" \
  -H "Authorization: Bearer <token>"
```

---

## GET /api/chat/search

Full-text search over the caller's own flat-chat history. Escrow-case threads are out
of scope — see [`docs/technical/chat-message-search.md`](../technical/chat-message-search.md).

- **Auth:** session cookie or bearer token
- **Query:** `q` (required, 2–200 chars), `peerId` (optional — narrows to one
  conversation), `page` ≥1 (default 1), `limit` 1–100 (default 30)
- **Response:** `200` `{ success: true, results: ChatMessageSearchResult[], total, page, limit }`
  — each result has `id`, `peerId`, `peerName`, `peerImage`, `content`, `messageType`,
  `createdAt`. Ordered newest-first.
- **Errors:** `400` (missing/too-short `q`), `401`, `500`, `503` with `Retry-After: 3`
  (search query didn't complete within 6s).

```bash
curl "https://<host>/api/chat/search?q=sapphire&page=1&limit=30" \
  -H "Authorization: Bearer <token>"
```

---

## POST /api/chat/messages/[messageId]/report

The end-user counterpart to the admin-only `POST /api/admin/chat-moderation/reports`
(see `docs/api/admin-chat-moderation-reports.md`) — files a `message_report` row
against a flat message. Only a participant (sender or recipient) may report it.

- **Auth:** session cookie or bearer token
- **Body:** `{ "reason": "string 1–1000 (required)" }`
- **Response:** `200` `{ success: true, report: { id }, alreadyReported?: true }` —
  `alreadyReported` is set (and no new row inserted) if this reporter already has an
  open/actioned report against the same message. `contentSnapshot` is taken from the
  message row server-side, never trusted from the request body.
- **Errors:**
  - `400` `Invalid input` — missing/empty `reason`
  - `401` `Unauthorized`
  - `404` `Message not found` — the message doesn't exist, **or** the caller isn't its
    sender or recipient (same response either way, so message ids can't be probed)
  - `500` `Failed to report message`

```bash
curl -X POST "https://<host>/api/chat/messages/msg_123/report" \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"reason":"spam"}'
```

---

**Mobile flag:** all endpoints on this page are consumed by the mobile app; response
shapes are frozen — additive changes only. See also
[`docs/api/chat-blocks.md`](./chat-blocks.md) for the self-service block/unblock
endpoints.
