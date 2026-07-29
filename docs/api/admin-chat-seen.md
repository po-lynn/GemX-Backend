# PATCH /api/admin/chat/seen

## Auth

Session cookie (Better Auth), `requireStrictAdmin` — role must be exactly `"admin"`.

## Request

No path params, query params, or body.

```
PATCH /api/admin/chat/seen
```

## Behavior

Upserts `admin_chat_cursor.last_seen_at` to the current time for the calling admin. This is what "clears" the nav bar bell badge — `GET /api/admin/chat/unread` counts messages created *after* this cursor, so anything before the PATCH stops counting as new.

Called automatically by `components/admin/NotificationBell.tsx` right after it loads the preview list on dropdown open — the list itself is fetched against the cursor's *previous* value, so the admin still sees what was new before the cursor moves.

## Response

**200 OK**

```json
{ "success": true }
```

**401 Unauthorized** — `{ "error": "Unauthorized" }`.

**403 Forbidden** — `{ "error": "Forbidden" }` (not role `"admin"`).

**500 Internal Server Error** — `{ "error": "Failed to mark oversight feed as seen" }`.

## Example

```bash
curl -X PATCH -b "better-auth.session_token=<token>" http://localhost:3000/api/admin/chat/seen
```

## Mobile flag

Not consumed by the mobile app.
