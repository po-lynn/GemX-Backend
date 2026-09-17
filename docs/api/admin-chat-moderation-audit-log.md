# GET /api/admin/chat-moderation/audit-log

Route file: `app/api/admin/chat-moderation/audit-log/route.ts`. The reader
side of `escrow_chat_audit_log` — backs the "Audit Trail" tab of
`/admin/messages/moderation` (per-thread and per-user audit trail viewer).

**Auth:** `requireAdminOrFeature(request, FEATURE_KEYS.CHAT_MODERATION)`.

**Mobile flag:** Not consumed by the mobile app — admin-only.

## Request

Query params — three mutually exclusive modes, checked in this order:

| Param        | Type     | Notes                                                              |
|--------------|----------|------------------------------------------------------------------------|
| `targetType` | `string` | One of `escrow_chat_audit_target`'s enum values (`escrow_case`\|`flat_message`\|`flat_thread`\|`case_message`\|`user`\|`report`). Requires `targetId` too — if only one of the pair is given, falls through to the next mode. |
| `targetId`   | `string` | Paired with `targetType` — e.g. a case id, a `pairKey(userA, userB)` for `flat_thread`, or a user id for `user`. |
| `actorId`    | `string` | Everything one staff member did — used when `targetType`/`targetId` aren't both given. |
| `actionType` | `string` | Only applies to the third (recent-feed) mode — one of `escrow_chat_audit_action`'s enum values. An unrecognized value is silently ignored. |

No path params, no body.

## Response

`200 OK`:

```json
{
  "success": true,
  "entries": [
    {
      "id": "audit-1",
      "actorId": "usr_mod",
      "actorName": "Mod One",
      "actionType": "thread_viewed",
      "targetType": "escrow_case",
      "targetId": "case-1",
      "beforeState": null,
      "afterState": null,
      "reason": null,
      "createdAt": "2026-09-16T10:00:00.000Z"
    }
  ]
}
```

Ordered newest-first. `listAuditLogForTarget`/`listAuditLogForActor` cap at
500 rows; the unfiltered recent feed (`listRecentAuditLog`, neither
`targetType`+`targetId` nor `actorId` given) caps at 200. `actorName` is
`null` for a system-authored row or a deleted actor account (`actorId` has
`onDelete: "set null"`).

### Errors

| Status | Body                                       | Cause                          |
|--------|-----------------------------------------------|-----------------------------------|
| 400    | `{ "error": "Invalid targetType" }`            | `targetType`+`targetId` both given but `targetType` isn't a real enum value |
| 401    | `{ "error": "Unauthorized" }`                  | No session                          |
| 403    | `{ "error": "Forbidden" }`                     | Missing the `chat.moderation` key   |
| 500    | `{ "error": "Failed to load audit log" }`      | Unexpected server error             |

## Examples

```bash
# Everything logged against one escrow case
curl -s \
  -H "Cookie: better-auth.session_token=<session-cookie>" \
  "http://localhost:3000/api/admin/chat-moderation/audit-log?targetType=escrow_case&targetId=case-1"

# Everything one moderator has done
curl -s \
  -H "Cookie: better-auth.session_token=<session-cookie>" \
  "http://localhost:3000/api/admin/chat-moderation/audit-log?actorId=usr_mod"

# Recent global feed, filtered to bans only
curl -s \
  -H "Cookie: better-auth.session_token=<session-cookie>" \
  "http://localhost:3000/api/admin/chat-moderation/audit-log?actionType=user_banned"
```
