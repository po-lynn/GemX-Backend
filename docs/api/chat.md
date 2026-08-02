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
  - `intervalMs` (SSE only) — poll cadence, clamped 2000–30000, default 4000
- **JSON mode:** `200` `{ success: true, conversations: ChatConversationListItem[] }`
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

**Mobile flag:** all three endpoints are consumed by the mobile app; response
shapes are frozen — additive changes only.
