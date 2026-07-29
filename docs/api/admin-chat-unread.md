# GET /api/admin/chat/unread

## Auth

Session cookie (Better Auth), `requireStrictAdmin` — role must be exactly `"admin"` (no `"internal"`/RBAC fallback).

## Request

No path params, query params, or body.

```
GET /api/admin/chat/unread
```

## Response

**200 OK**

```json
{ "success": true, "total": 3 }
```

`total` is the count of messages created system-wide since this admin's last-seen cursor (`admin_chat_cursor.last_seen_at`, defaulting to the epoch if the admin has never opened the bell), **excluding messages the admin themself sent**.

**401 Unauthorized** — `{ "error": "Unauthorized" }` (no session).

**403 Forbidden** — `{ "error": "Forbidden" }` (session role isn't `"admin"`).

**500 Internal Server Error** — `{ "error": "Failed to load unread count" }`.

## Example

```bash
curl -b "better-auth.session_token=<token>" http://localhost:3000/api/admin/chat/unread
```

## Mobile flag

Not consumed by the mobile app — backs the admin panel's nav bar bell for `role === "admin"` users only. See `docs/api/chat-unread-preview.md` for the personal-inbox equivalent (`/api/chat/unread`) used by internal staff.
