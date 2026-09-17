# /api/admin/chat-moderation/reports

Covers `GET`/`POST /api/admin/chat-moderation/reports` and `POST
/api/admin/chat-moderation/reports/[id]/resolve`. Route files:
`app/api/admin/chat-moderation/reports/route.ts`,
`app/api/admin/chat-moderation/reports/[id]/resolve/route.ts`.

**Mobile flag:** Not consumed by the mobile app. There is no end-user
"report this message" mobile endpoint yet (out of scope for this
admin-backend-only feature — see `docs/technical/escrow-case-messaging.md`'s
edge case #16) — `reporterId` on every report created through this API is
always the session's own staff account.

**Auth (all three):** `requireAdminOrFeature(request, FEATURE_KEYS.CHAT_MODERATION)`.

---

## GET /api/admin/chat-moderation/reports

### Request

Query params:

| Param    | Type     | Notes                                                              |
|----------|----------|------------------------------------------------------------------------|
| `status` | `string` | One of `message_report_status`'s enum values (`open`\|`dismissed`\|`actioned`). An unrecognized value is silently ignored (treated as "no filter"), not rejected. |

### Response

`200 OK`:

```json
{
  "success": true,
  "reports": [
    {
      "id": "report-1",
      "flatMessageId": "msg-1",
      "caseMessageId": null,
      "reporterId": "usr_mod",
      "reporterName": "Mod One",
      "reason": "spam link",
      "contentSnapshot": "buy cheap gems at ...",
      "status": "open",
      "resolvedAt": null,
      "resolvedByAdminId": null,
      "resolutionAction": null,
      "resolutionReason": null,
      "createdAt": "2026-09-16T00:00:00.000Z",
      "senderId": "usr_offender",
      "senderName": "Some User"
    }
  ]
}
```

Exactly one of `flatMessageId`/`caseMessageId` is set per row (the
underlying `message_report_exactly_one_target` CHECK constraint).
`senderId`/`senderName` are resolved from whichever message table the
report points at, and are `null` if the underlying message no longer
exists (e.g. a prior `delete_message` resolution). Ordered newest-first,
capped at 200 rows.

#### Errors

| Status | Body                                       | Cause                          |
|--------|-----------------------------------------------|-----------------------------------|
| 401    | `{ "error": "Unauthorized" }`                  | No session                          |
| 403    | `{ "error": "Forbidden" }`                     | Missing the `chat.moderation` key   |
| 500    | `{ "error": "Failed to load reports" }`        | Unexpected server error             |

### Example

```bash
curl -s \
  -H "Cookie: better-auth.session_token=<session-cookie>" \
  "http://localhost:3000/api/admin/chat-moderation/reports?status=open"
```

---

## POST /api/admin/chat-moderation/reports

Files a report — today always moderator-initiated while reviewing a
thread, not end-user-submitted (see the file header note above).

### Request

Body — `createSchema`:

| Field             | Type     | Required | Constraint                                                    |
|-------------------|----------|----------|--------------------------------------------------------------|
| `flatMessageId`   | `string` | conditionally | `.trim().min(1)` — exactly one of `flatMessageId`/`caseMessageId` required |
| `caseMessageId`   | `string` | conditionally | `.trim().min(1)` — exactly one of `flatMessageId`/`caseMessageId` required |
| `reason`          | `string` | yes      | `.trim().min(1).max(1000)`                                       |
| `contentSnapshot` | `string` | yes      | `.trim().min(1).max(5000)` — the reported message's content, captured by the caller (a flat message is hard-deleted on `delete_message`, so this is the only surviving record of what was said) |

`reporterId` is always the session user — never accepted from the request
body.

### Response

`200 OK`: `{ "success": true, "report": { "id": "report-1" } }`

#### Errors

| Status | Body                                                                    | Cause                          |
|--------|--------------------------------------------------------------------------------|-----------------------------------|
| 400    | `{ "error": "Invalid input" }`                                                    | Malformed body, a field fails its constraint, or both/neither of `flatMessageId`/`caseMessageId` given |
| 401    | `{ "error": "Unauthorized" }`                                                     | No session                          |
| 403    | `{ "error": "Forbidden" }`                                                        | Missing the `chat.moderation` key   |
| 500    | `{ "error": "Failed to create report" }`                                          | Unexpected server error             |

### Example

```bash
curl -s -X POST \
  -H "Cookie: better-auth.session_token=<session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{"flatMessageId":"msg-1","reason":"spam link","contentSnapshot":"buy cheap gems at ..."}' \
  "http://localhost:3000/api/admin/chat-moderation/reports"
```

---

## POST /api/admin/chat-moderation/reports/[id]/resolve

Resolves an open report with one of five actions, each requiring a reason.
Runs `resolveMessageReport()` — see
`docs/technical/escrow-case-messaging.md`'s "Reports queue → resolution"
data-flow diagram for the exact step sequence.

### Request

Path params:

| Param | Type   | Required | Notes                        |
|-------|--------|----------|-----------------------------------|
| `id`  | string | yes      | Report id (`message_report.id`)     |

Body — `resolveSchema`:

| Field    | Type     | Required | Constraint                                                       |
|----------|----------|----------|-------------------------------------------------------------------|
| `action` | `string` | yes      | One of `message_report_resolution`'s enum values: `dismiss`\|`warn`\|`delete_message`\|`mute_user`\|`ban_user` |
| `reason` | `string` | yes      | `.trim().min(1).max(1000)`                                            |

**What each action does**, beyond marking the report `dismissed` (for
`dismiss`) or `actioned` (everything else):

| Action | Effect |
|---|---|
| `dismiss` | Nothing further — recorded as not a violation. |
| `warn` | Nothing further today — no in-app warning/notification surface exists yet (see edge case #17). Recorded for the audit trail only. |
| `delete_message` | Hard-deletes the underlying `messages` or `escrow_case_message` row. |
| `mute_user` | Issues a **7-day mute** (hardcoded duration — see edge case #21) against the reported message's **sender** (never the reporter), via `issueRestriction()`. |
| `ban_user` | Issues an **indefinite ban** against the sender, via `issueRestriction()`. |

### Response

`200 OK`: `{ "success": true }`

#### Errors

| Status | Body                                                            | Cause                          |
|--------|--------------------------------------------------------------------|-----------------------------------|
| 400    | `{ "error": "Invalid input" }`                                       | Malformed body, or `reason`/`action` fails its constraint |
| 401    | `{ "error": "Unauthorized" }`                                        | No session                          |
| 403    | `{ "error": "Forbidden" }`                                           | Missing the `chat.moderation` key   |
| 404    | `{ "error": "Not found" }`                                           | No report with that `id`            |
| 409    | `{ "error": "Report was already resolved" }`                         | `status` is no longer `"open"`      |
| 500    | `{ "error": "Failed to resolve report" }`                            | Unexpected server error (includes the "sender no longer exists" case for `mute_user`/`ban_user` — see edge case in the technical doc) |

### Example

```bash
curl -s -X POST \
  -H "Cookie: better-auth.session_token=<session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{"action":"ban_user","reason":"repeated abuse after a prior mute"}' \
  "http://localhost:3000/api/admin/chat-moderation/reports/report-1/resolve"
```
