# /api/admin/escrow-cases/[id]/messages

Covers `GET` (list case-thread messages) and `POST` (send a case-thread
message). Route file: `app/api/admin/escrow-cases/[id]/messages/route.ts`.

**Mobile flag:** Not consumed by the mobile app — admin-only.

---

## GET /api/admin/escrow-cases/[id]/messages

**Auth:** `requireEscrowCaseAccess(request, id)` — same check as
`GET /api/admin/escrow-cases/[id]` (see
[`docs/api/admin-escrow-cases-detail.md`](./admin-escrow-cases-detail.md) for
the full scope breakdown). Any of the four access scopes may read the shared
`"case"` thread: `admin`, `supervisor`, `own` (assigned agent), and
**`moderation`** — a chat moderator holding the `chat.moderation` feature key
gets read access to any case's shared thread.

**Side-channel visibility is withheld from the `moderation` scope.** The
route passes `includeSideChannel = access.scope !== "moderation"` to
`listEscrowCaseMessages()` — `admin`/`supervisor`/`own` get `agent_buyer`/
`agent_seller` rows alongside `"case"` ones; `moderation` gets only `"case"`
rows. General chat oversight doesn't imply access to one specific case's
confidential agent↔party notes.

**A `moderation`-scope read is audit-logged (Step 6).** After a successful
read, if `access.scope === "moderation"` the route calls
`recordThreadViewed({ actorId: session.user.id, targetType: "escrow_case",
targetId: id })`, writing a `thread_viewed` row to `escrow_chat_audit_log`.
`admin`/`supervisor`/`own` reads are **not** logged — that's ordinary
casework by someone with real access to the case, not oversight; logging
every poll of an agent's own assigned case would drown the audit trail in
noise with zero oversight value. Neither the case's buyer/seller/agent is
notified of the view.

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

Messages are ordered oldest-first (ascending `createdAt`) and, for a viewer
who isn't scoped `"moderation"`, include `agent_buyer`/`agent_seller`
side-channel rows interleaved with `"case"` ones (see "Auth" above) —
`visibility` on each row tells the caller which. `senderId` is `null` for a
`kind: "system"` row. `attachmentType` is one of `text | image | audio |
file`. There is no per-party (buyer-only vs. seller-only) filter — this API
surface is admin/staff-only, so nothing calling it is ever "the buyer" or
"the seller" needing their own restricted view.

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

**Mute/ban check (Step 6):** before anything else, the route calls
`getActiveRestriction(senderId)` (`features/chat-moderation/db/
restrictions.ts`) — a sender with an active `messaging_restriction` row gets
`403` with the restriction's reason, and nothing is written. This is the
same check `POST /api/chat/messages` runs; see `docs/api/chat.md`.

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

| Field            | Type     | Required | Constraint                                                    |
|------------------|----------|----------|------------------------------------------------------------------|
| `content`        | string   | no*      | `.trim().max(5000)`                                                |
| `visibility`     | string   | no       | One of `escrow_case_message_visibility`'s enum values (`case`, `agent_buyer`, `agent_seller`); defaults to `"case"` |
| `fileUrl`        | string   | no*      | `.trim().url().max(2000)` — a non-image attachment (PDF, doc)      |
| `imageUrls`      | string[] | no*      | `.url()`, exactly one entry (`min(1).max(1)`) — an image attachment |
| `attachmentType` | string   | no       | One of `message_type`'s enum values (`text`\|`image`\|`audio`\|`file`) |

\* At least one of `content`, `fileUrl`, or `imageUrls` is required
(`.refine(...)`, same rule as `POST /api/chat/messages`) — a caption is
optional once there's a file, so an agent sharing a payment slip isn't
forced to type something first.

The saved message is always written with `kind: "message"`; it is a wholly
separate write path against `escrow_case_message`, never the flat
`messages` table, so an operator post can never be injected into a private
1:1 buyer/seller chat.

**Attachments are also recorded as case-level evidence.** If `fileUrl` or
`imageUrls[0]` is present, the route (awaited, not fire-and-forget) also
inserts one `escrow_case_attachment` row — `caseId`, `messageId`: the new
message's id, `uploadedByUserId`: the sender, `url`, `fileType` from the
saved message's `attachmentType` — so the file shows up both inline in the
thread and in the case's independent evidence list (see
[`docs/api/admin-escrow-cases-attachments.md`](./admin-escrow-cases-attachments.md)).
This endpoint does not upload the file itself — the client uploads first
(e.g. via `POST /api/chat/media`) and passes the resulting URL here.

**Side channel (`visibility: "agent_buyer"` or `"agent_seller"`)** — the
agent (or a supervisor/admin covering the case) messaging one party
privately from within the case. There is no separate "recipient" field:
`agent_buyer` always means "visible to the buyer + the agent, never the
seller" and `agent_seller` the mirror. `senderId` is still always the
session user, same as an ordinary message — never a synthetic "operator"
identity.

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

**Side effects:**

- `broadcastCaseEvents(id, [{ event: "case_message_new", payload: saved }])`
  — fire-and-forget Supabase Realtime broadcast to the case's channel
  (`.catch`-logged, never surfaces to the caller).
- **Awaited, not fire-and-forget:** if `visibility !== "case"`, one row is
  inserted into `escrow_chat_audit_log` (`actionType:
  "side_channel_message_sent"`, `targetType: "case_message"`, `targetId`:
  the new message's id, `afterState: { visibility }`) *before* the `200`
  response — a side-channel message with no audit trail would defeat the
  point of it being independently auditable. A failure here falls through
  to the generic `500` below.
- `sendEscrowCaseMessageNotification(...)` — fire-and-forget push,
  recipient list scoped to `visibility`:
  - `"case"` → `[buyerId, sellerId, assignedAgentId]`
  - `"agent_buyer"` → `[buyerId, assignedAgentId]` only — the seller is
    never notified, not just unable to read the content
  - `"agent_seller"` → `[sellerId, assignedAgentId]` only
  The sender's own id is filtered out of whichever list applies. Uses the
  sender's `user.name` (falls back to `"Someone"` if blank) and the message
  content as the push preview.

#### Errors

| Status | Body                                    | Cause                                                                                                         |
|--------|--------------------------------------------|---------------------------------------------------------------------------------------------------------------------|
| 400    | `{ "error": "Invalid input" }`             | Body missing/malformed, none of `content`/`fileUrl`/`imageUrls` provided, `content` over 5000 chars, `visibility`/`attachmentType` not a real enum value, or `imageUrls` has more than one entry |
| 401    | `{ "error": "Unauthorized" }`              | No session                                                                                                            |
| 403    | `{ "error": "Forbidden" }`                 | Either the caller has no case access at all, **or** the caller's scope is `"moderation"` (read-only chat moderator) |
| 403    | `You are banned/muted from messaging: <reason>` | The sender has an active `messaging_restriction` row (checked before the access-scope check's write rejection would even matter) |
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

Side-channel example (visible only to the buyer + the agent):

```bash
curl -s -X POST \
  -H "Cookie: better-auth.session_token=<session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{"content":"Your payment looks a bit short — can you confirm?","visibility":"agent_buyer"}' \
  "http://localhost:3000/api/admin/escrow-cases/case-1/messages"
```
