# GET /api/admin/messages/thread

**Auth:** admin session, or `role === "internal"` holding **either** the
`messages` or `chat_dashboard` RBAC permission (`requireAdminOrAnyFeature` in
`lib/api-guard.ts`). This deliberately differs from the very similar
`/api/admin/chat/all-conversations/messages` (admin-only, see that route's
own doc) — this endpoint backs the merged Messages triage inbox, whose page
guard (`requireMessagesAccess`) already accepts either permission, so the
thread fetch has to match or internal staff would load the list but 403 on
opening a thread.

**Mobile flag:** not used by the mobile app — admin web panel only
(`app/admin/messages/page.tsx`'s reading pane).

## Request

Query params (all via `?...`):

| Param   | Type   | Required | Notes                                          |
|---------|--------|----------|--------------------------------------------------|
| `userA` | string | yes      | One participant's user id                       |
| `userB` | string | yes      | The other participant's user id — must differ from `userA` |
| `page`  | number | no       | Default `1`, min `1`                            |
| `limit` | number | no       | Default `200`, min `1`, max `200`               |

Validated by a Zod schema (`querySchema` in the route file). Neither `userA`
nor `userB` needs to be the calling user.

## Response

`200 OK` — identical shape to `/api/admin/chat/all-conversations/messages`
(same underlying `getConversationMessagesForAdmin` query,
`features/chat/db/admin-all-conversations.ts`):

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
      "createdAt": "2026-07-29T06:23:00.000Z",
      "starred": false
    }
  ],
  "page": 1,
  "limit": 200,
  "total": 2
}
```

Messages are ordered oldest-first (ascending `createdAt`).

### Errors

| Status | Body                                          | Cause                                       |
|--------|-----------------------------------------------|----------------------------------------------|
| 401    | `{ "error": "Unauthorized" }`                 | No session                                    |
| 403    | `{ "error": "Forbidden" }`                    | `role === "internal"` without `messages` or `chat_dashboard` permission (or any other role) |
| 400    | `{ "error": "userA and userB must differ" }`  | `userA === userB`                             |
| 500    | `{ "error": "Failed to load messages" }`      | Unexpected server error                       |

## Example

```bash
curl -s \
  -H "Cookie: better-auth.session_token=<session-cookie>" \
  "http://localhost:3000/api/admin/messages/thread?userA=USER_A_ID&userB=USER_B_ID&page=1&limit=200"
```
