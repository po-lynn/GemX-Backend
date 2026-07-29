# GET /api/admin/chat/all-conversations/messages

**Auth:** admin session cookie only — `role === "admin"` exactly (`requireStrictAdmin`
in `lib/api-guard.ts`). Unlike other admin chat/message endpoints, `role === "internal"`
is **not** accepted here even with the `chat_dashboard` RBAC permission, since this
endpoint returns full message content for arbitrary user pairs, not just the caller's
own conversations.

**Mobile flag:** not used by the mobile app — admin web panel only.

## Request

Query params (all via `?...`):

| Param   | Type   | Required | Notes                                  |
|---------|--------|----------|-----------------------------------------|
| `userA` | string | yes      | One participant's user id               |
| `userB` | string | yes      | The other participant's user id — must differ from `userA` |
| `page`  | number | no       | Default `1`, min `1`                    |
| `limit` | number | no       | Default `100`, min `1`, max `200`       |

Validated by a Zod schema (`querySchema` in the route file). Neither `userA` nor
`userB` needs to be the calling admin.

## Response

`200 OK`:

```json
{
  "success": true,
  "messages": [
    {
      "id": "uuid",
      "senderId": "user-a",
      "recipientId": "user-b",
      "content": "How are you doing?",
      "fileUrl": null,
      "imageUrls": null,
      "messageType": "text",
      "createdAt": "2026-07-29T06:23:00.000Z"
    }
  ],
  "page": 1,
  "limit": 100,
  "total": 2
}
```

Messages are ordered oldest-first (ascending `createdAt`), matching `/api/chat/history`.

### Errors

| Status | Body                                            | Cause                                  |
|--------|--------------------------------------------------|-----------------------------------------|
| 401    | `{ "error": "Unauthorized" }`                    | No session                              |
| 403    | `{ "error": "Forbidden" }`                       | `role !== "admin"` (including `internal`) |
| 400    | `{ "error": "userA and userB must differ" }`     | `userA === userB`                       |
| 500    | `{ "error": "Failed to load messages" }`         | Unexpected server error                 |

## Example

```bash
curl -s \
  -H "Cookie: better-auth.session_token=<admin-session-cookie>" \
  "http://localhost:3000/api/admin/chat/all-conversations/messages?userA=sys-website-contact-form&userB=USER_ID&page=1&limit=100"
```
