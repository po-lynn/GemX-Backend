# GET /api/chat/unread/preview

## Auth

Session cookie (Better Auth). Any authenticated user — no role restriction. Returns only the caller's own unread messages.

## Request

No path params, query params, or body.

```
GET /api/chat/unread/preview
```

## Response

**200 OK**

```json
{
  "success": true,
  "conversations": [
    {
      "userId": "string",
      "name": "string",
      "profileImage": "string | null",
      "lastMessage": "string",
      "lastMessageTime": "ISO 8601 string",
      "unreadCount": "number"
    }
  ]
}
```

One entry per peer with at least one unread message (`messages.isRead = false` where `recipientId` is the caller), most-recently-active first, capped at 20 entries. `lastMessage` is the content of that peer's most recent unread message (or a type label like `"Sent photos"` / `"Voice message"` / `"Sent a file"` for non-text messages with empty content).

**401 Unauthorized**

```json
{ "error": "Unauthorized" }
```

No session.

**500 Internal Server Error**

```json
{ "error": "Failed to load unread conversations" }
```

Unexpected DB error.

## Example

```bash
curl -b "better-auth.session_token=<token>" http://localhost:3000/api/chat/unread/preview
```

```json
{
  "success": true,
  "conversations": [
    {
      "userId": "usr_abc123",
      "name": "Jane Seller",
      "profileImage": null,
      "lastMessage": "Is this still available?",
      "lastMessageTime": "2026-07-29T04:12:00.000Z",
      "unreadCount": 2
    }
  ]
}
```

## Mobile flag

Not consumed by the mobile app — this backs the admin panel's nav bar notification bell only (`components/admin/NotificationBell.tsx`).
