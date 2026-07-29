# GET /api/admin/chat/unread/preview

## Auth

Session cookie (Better Auth), `requireStrictAdmin` — role must be exactly `"admin"`.

## Request

No path params, query params, or body.

```
GET /api/admin/chat/unread/preview
```

## Response

**200 OK**

```json
{
  "success": true,
  "conversations": [
    {
      "participants": [
        { "id": "user_abc", "name": "Alice", "image": null, "role": "user" },
        { "id": "user_def", "name": "Bob", "image": null, "role": "user" }
      ],
      "lastMessage": "Is this still available?",
      "lastMessageTime": "2026-07-29T04:12:00.000Z",
      "lastMessageType": "text"
    }
  ]
}
```

One entry per conversation pair whose latest message arrived after this admin's last-seen cursor and wasn't sent by the admin themself, most-recently-active first, capped at 20. Same participant/preview shape as `GET /api/admin/chat/all-conversations` (the full oversight list) — this is just the "what's new" subset of it.

**401 Unauthorized** — `{ "error": "Unauthorized" }`.

**403 Forbidden** — `{ "error": "Forbidden" }` (not role `"admin"`).

**500 Internal Server Error** — `{ "error": "Failed to load new conversations" }`.

## Example

```bash
curl -b "better-auth.session_token=<token>" http://localhost:3000/api/admin/chat/unread/preview
```

## Mobile flag

Not consumed by the mobile app — backs the admin panel's nav bar notification dropdown for `role === "admin"` users.
