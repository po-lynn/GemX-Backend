# /api/admin/chat-moderation/restrictions

Covers `GET`/`POST /api/admin/chat-moderation/restrictions` and `PATCH
/api/admin/chat-moderation/restrictions/[id]`. Route files:
`app/api/admin/chat-moderation/restrictions/route.ts`,
`app/api/admin/chat-moderation/restrictions/[id]/route.ts`.

**Mobile flag:** Not consumed by the mobile app — admin-only. There is no
in-app surface today that tells a muted/banned user *why*; the reason is
only exposed via the `403` error message on their next send attempt (see
`docs/api/chat.md` and `docs/api/admin-escrow-cases-messages.md`).

**Auth (all three):** `requireAdminOrFeature(request, FEATURE_KEYS.CHAT_MODERATION)`
— admin, or internal holding the `chat.moderation` RBAC permission. No
`staff_role` check beyond the feature key: any internal user with this key
can issue/lift restrictions, regardless of their `staff_role`.

---

## GET /api/admin/chat-moderation/restrictions

### Request

Query params:

| Param        | Type      | Default | Notes                                                    |
|--------------|-----------|---------|------------------------------------------------------------|
| `userId`     | `string`  | —       | Filter to one user's restriction history.                   |
| `activeOnly` | `string`  | `true`  | Any value other than the literal string `"false"` means true — only rows where `liftedAt IS NULL` and (`expiresAt IS NULL` or `expiresAt > now()`). |

### Response

`200 OK`:

```json
{
  "success": true,
  "restrictions": [
    {
      "id": "restriction-1",
      "userId": "usr_offender",
      "userName": "Some User",
      "restrictionType": "mute",
      "reason": "repeated spam links",
      "issuedByAdminId": "usr_admin",
      "issuedByName": "Admin One",
      "startsAt": "2026-09-16T00:00:00.000Z",
      "expiresAt": "2026-09-23T00:00:00.000Z",
      "liftedAt": null,
      "liftedByAdminId": null,
      "liftReason": null,
      "createdAt": "2026-09-16T00:00:00.000Z"
    }
  ]
}
```

`expiresAt: null` means a ban (indefinite). Ordered newest-first, capped at
200 rows.

#### Errors

| Status | Body                                       | Cause                          |
|--------|-----------------------------------------------|-----------------------------------|
| 401    | `{ "error": "Unauthorized" }`                  | No session                          |
| 403    | `{ "error": "Forbidden" }`                     | Missing the `chat.moderation` key   |
| 500    | `{ "error": "Failed to load restrictions" }`   | Unexpected server error             |

### Example

```bash
curl -s \
  -H "Cookie: better-auth.session_token=<session-cookie>" \
  "http://localhost:3000/api/admin/chat-moderation/restrictions?userId=usr_offender&activeOnly=false"
```

---

## POST /api/admin/chat-moderation/restrictions

Issues a mute (fixed duration) or ban (indefinite), each with a mandatory
reason. Writes the restriction row and a `user_muted`/`user_banned` audit
row in one transaction (`issueRestriction()`).

### Request

Body — `createSchema` in the route file:

| Field             | Type              | Required | Constraint                                                    |
|-------------------|-------------------|----------|--------------------------------------------------------------|
| `userId`          | `string`          | yes      | `.trim().min(1)` — the user being restricted                    |
| `restrictionType` | `"mute" \| "ban"` | yes      | `z.enum(messagingRestrictionTypeEnum.enumValues)`               |
| `reason`          | `string`          | yes      | `.trim().min(1).max(1000)`                                       |
| `durationHours`   | `number`          | conditionally | `.int().positive().max(24*365)` — **required** when `restrictionType === "mute"`; ignored for `"ban"` (a ban is always indefinite, `expiresAt: null`) |

`issuedByAdminId` is always the session user — never accepted from the
request body.

### Response

`200 OK`, the created restriction row (same shape as one `GET` entry) under
`restriction`.

#### Errors

| Status | Body                                             | Cause                          |
|--------|--------------------------------------------------------|-----------------------------------|
| 400    | `{ "error": "Invalid input" }`                            | Malformed body, or a field fails its constraint |
| 400    | `{ "error": "durationHours is required for a mute" }`     | `restrictionType: "mute"` with no `durationHours` |
| 401    | `{ "error": "Unauthorized" }`                             | No session                          |
| 403    | `{ "error": "Forbidden" }`                                | Missing the `chat.moderation` key   |
| 500    | `{ "error": "Failed to issue restriction" }`              | Unexpected server error             |

### Example

```bash
# 7-day mute
curl -s -X POST \
  -H "Cookie: better-auth.session_token=<session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{"userId":"usr_offender","restrictionType":"mute","reason":"repeated spam links","durationHours":168}' \
  "http://localhost:3000/api/admin/chat-moderation/restrictions"

# indefinite ban
curl -s -X POST \
  -H "Cookie: better-auth.session_token=<session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{"userId":"usr_offender","restrictionType":"ban","reason":"repeated abuse after mute"}' \
  "http://localhost:3000/api/admin/chat-moderation/restrictions"
```

---

## PATCH /api/admin/chat-moderation/restrictions/[id]

Lifts (restores) a restriction — sets `liftedAt`/`liftedByAdminId`/
`liftReason` and writes a `user_restriction_lifted` audit row, in one
transaction (`liftRestriction()`). This is a soft "removal" — the row is
never deleted, so it stays as a permanent record that the user was once
restricted and why.

### Request

Path params:

| Param | Type   | Required | Notes                                  |
|-------|--------|----------|--------------------------------------------|
| `id`  | string | yes      | Restriction id (`messaging_restriction.id`) |

Body — `liftSchema`:

| Field        | Type   | Required | Constraint            |
|--------------|--------|----------|----------------------------|
| `liftReason` | string | yes      | `.trim().min(1).max(1000)`   |

### Response

`200 OK`: `{ "success": true }`

#### Errors

| Status | Body                                             | Cause                          |
|--------|--------------------------------------------------------|-----------------------------------|
| 400    | `{ "error": "Invalid input" }`                            | `liftReason` missing/empty/over 1000 chars |
| 401    | `{ "error": "Unauthorized" }`                             | No session                          |
| 403    | `{ "error": "Forbidden" }`                                | Missing the `chat.moderation` key   |
| 404    | `{ "error": "Not found" }`                                | No restriction with that `id`       |
| 500    | `{ "error": "Failed to lift restriction" }`               | Unexpected server error             |

### Example

```bash
curl -s -X PATCH \
  -H "Cookie: better-auth.session_token=<session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{"liftReason":"appeal accepted"}' \
  "http://localhost:3000/api/admin/chat-moderation/restrictions/restriction-1"
```
