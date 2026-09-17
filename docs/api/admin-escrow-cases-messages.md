# /api/admin/escrow-cases/[id]/messages

Covers `GET` (list case-thread messages) and `POST` (send a case-thread
message). Route file: `app/api/admin/escrow-cases/[id]/messages/route.ts`.

**Mobile flag:** Not consumed by the mobile app — admin-only.

---

## GET /api/admin/escrow-cases/[id]/messages

**Auth:** `requireEscrowCaseAccess(request, id)` — same check as
`GET /api/admin/escrow-cases/[id]` (see
[`docs/api/admin-escrow-cases-detail.md`](./admin-escrow-cases-detail.md) for
the full scope breakdown). Any of the four access scopes may read: `admin`,
`supervisor`, `own` (assigned agent), and **`moderation`** — a chat moderator
holding the `chat.moderation` feature key gets full read access to any case's
thread, per the route's own comment ("any access scope may read, including
read-only moderation oversight").

### Request

Path params:

| Param | Type   | Required | Notes                  |
|-------|--------|----------|--------------------------|
| `id`  | string | yes      | Escrow case id (`escrow_case.id`) |

No query params, no body.

### Response

`200 OK`:

```json
{
  "success": true,
  "messages": [
    {
      "id": "msg-1",
      "caseId": "case-1",
      "senderId": "usr_buyer",
      "kind": "message",
      "visibility": "case",
      "content": "When can we schedule the handover?",
      "fileUrl": null,
      "imageUrls": null,
      "attachmentType": "text",
      "systemEventType": null,
      "systemEventPayload": null,
      "createdAt": "2026-09-15T10:02:00.000Z"
    }
  ]
}
```

Messages are ordered oldest-first (ascending `createdAt`). `listEscrowCaseMessages`
only returns rows with `visibility = "case"` — the shared buyer/seller/agent
thread; `agent_buyer`/`agent_seller` side-channel visibility is a documented
future addition, not currently returned by this endpoint. `senderId` is
`null` for a `kind: "system"` row. `attachmentType` is one of `text | image |
audio | file`.

#### Errors

| Status | Body                                   | Cause                                                                                  |
|--------|-------------------------------------------|--------------------------------------------------------------------------------------------|
| 401    | `{ "error": "Unauthorized" }`             | No session                                                                                   |
| 403    | `{ "error": "Forbidden" }`                | Caller has none of the four access scopes                                                   |
| 404    | `{ "error": "Not found" }`                | No case with that `id` (from `requireEscrowCaseAccess`'s `getEscrowCaseById` lookup)         |
| 500    | `{ "error": "Failed to load messages" }`  | Unexpected server error                                                                       |

### Example

```bash
curl -s \
  -H "Cookie: better-auth.session_token=<session-cookie>" \
  "http://localhost:3000/api/admin/escrow-cases/case-1/messages"
```

---

## POST /api/admin/escrow-cases/[id]/messages

**Auth:** `requireEscrowThreadWriteAccess(request, id)`
(`features/escrow-cases/lib/case-access.ts`) — runs `requireEscrowCaseAccess`
first (see above), **then explicitly rejects the `"moderation"` scope**:

```ts
const access = await requireEscrowCaseAccess(request, caseId)
if (!access.ok) return access
if (access.scope === "moderation") return { ok: false, error: jsonError("Forbidden", 403) }
return access
```

So a chat moderator (staff role `moderator` + `chat.moderation` feature key)
**passes the case-access check but is then turned away with a second,
scope-specific `403 Forbidden`** — moderators get read-only oversight of
escrow threads via `GET`, never posting rights, per the feature brief
("moderators get oversight, not escrow-thread participation"). This is a
distinct rejection path from the plain "caller has no access at all" `403` —
both currently return the identical `{ "error": "Forbidden" }` body and `403`
status, but they are reached through different branches: a moderator reaches
this route's `requireEscrowCaseAccess` with `ok: true, scope: "moderation"`
and is rejected by `requireEscrowThreadWriteAccess`'s own check, whereas a
caller with **no** case access at all is rejected earlier, inside
`requireEscrowCaseAccess` itself. `admin`, `supervisor`, and `own` scopes may
all post — including a supervisor/admin posting into a case they are not
personally assigned to (the "operator exception"; it only ever applies to a
case thread via this same check, never to a private 1:1 chat, since a 1:1
thread has no `caseId`).

### Request

Path params:

| Param | Type   | Required | Notes                  |
|-------|--------|----------|--------------------------|
| `id`  | string | yes      | Escrow case id (`escrow_case.id`) |

Body — `sendMessageSchema` in
`app/api/admin/escrow-cases/[id]/messages/route.ts`:

| Field     | Type   | Required | Constraint                       |
|-----------|--------|----------|------------------------------------|
| `content` | string | yes      | `.trim().min(1).max(5000)`         |

The saved message is always written with `kind: "message"`, `visibility:
"case"`, and `attachmentType: "text"` — this endpoint has no file/image
attachment fields; it is a wholly separate write path against
`escrow_case_message`, never the flat `messages` table, so an operator post
can never be injected into a private 1:1 buyer/seller chat.

### Response

`200 OK`:

```json
{
  "success": true,
  "message": {
    "id": "msg-2",
    "caseId": "case-1",
    "senderId": "usr_agent",
    "kind": "message",
    "visibility": "case",
    "content": "Handover is scheduled for Friday.",
    "fileUrl": null,
    "imageUrls": null,
    "attachmentType": "text",
    "systemEventType": null,
    "systemEventPayload": null,
    "createdAt": "2026-09-15T10:05:00.000Z"
  }
}
```

**Side effects** (both fire-and-forget — neither failure changes the `200`
response; both are `.catch`-logged to `console.error`, never surfaced to the
caller):

- `broadcastCaseEvents(id, [{ event: "case_message_new", payload: saved }])` —
  Supabase Realtime broadcast to the case's channel.
- `sendEscrowCaseMessageNotification(...)` — push notification to
  `[buyerId, sellerId, assignedAgentId].filter(Boolean)` (the sender's own id
  is not excluded from this list by the route itself), using the sender's
  `user.name` (falls back to `"Someone"` if blank) and the message content as
  the preview.

#### Errors

| Status | Body                                    | Cause                                                                                                         |
|--------|--------------------------------------------|---------------------------------------------------------------------------------------------------------------------|
| 400    | `{ "error": "Invalid input" }`             | Body missing/malformed, or fails `sendMessageSchema` (empty or >5000-char `content`)                                |
| 401    | `{ "error": "Unauthorized" }`              | No session                                                                                                            |
| 403    | `{ "error": "Forbidden" }`                 | Either the caller has no case access at all, **or** the caller's scope is `"moderation"` (read-only chat moderator) |
| 404    | `{ "error": "Not found" }`                 | No case with that `id`                                                                                                |
| 500    | `{ "error": "Failed to send message" }`    | Unexpected server error                                                                                                |

### Example

```bash
curl -s -X POST \
  -H "Cookie: better-auth.session_token=<session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{"content":"Handover is scheduled for Friday."}' \
  "http://localhost:3000/api/admin/escrow-cases/case-1/messages"
```
