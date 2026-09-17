# /api/admin/escrow-cases/[id]/attachments

`GET` (list case evidence) and `POST` (upload one evidence file). Route
file: `app/api/admin/escrow-cases/[id]/attachments/route.ts`.

**Mobile flag:** Not consumed by the mobile app — admin-only.

---

## GET /api/admin/escrow-cases/[id]/attachments

**Auth:** `requireEscrowCaseAccess(request, id)` — same four scopes as
[`docs/api/admin-escrow-cases-messages.md`](./admin-escrow-cases-messages.md#get-apiadminescrow-casesidmessages),
including the read-only `"moderation"` scope: reviewing evidence is part of
overseeing a case, so it isn't withheld the way side-channel messages are.

### Request

Path params:

| Param | Type   | Required | Notes                              |
|-------|--------|----------|--------------------------------------|
| `id`  | string | yes      | Escrow case id (`escrow_case.id`)  |

No query params, no body.

### Response

`200 OK`:

```json
{
  "success": true,
  "attachments": [
    {
      "id": "att-1",
      "caseId": "case-1",
      "messageId": "msg-1",
      "uploadedByUserId": "usr_agent",
      "url": "https://.../evidence/agent-1/167...-uuid.pdf",
      "fileType": "file",
      "label": null,
      "createdAt": "2026-09-16T00:00:00.000Z"
    }
  ]
}
```

Newest first (`ORDER BY created_at DESC`). `messageId` is `null` for
evidence uploaded directly via this route's `POST` rather than attached to
a chat message. `fileType` is `"image"` or `"file"` — never `"audio"`
(evidence is photos/documents, not voice notes).

#### Errors

| Status | Body                                       | Cause                          |
|--------|-------------------------------------------------|-----------------------------------|
| 401    | `{ "error": "Unauthorized" }`                     | No session                          |
| 403    | `{ "error": "Forbidden" }`                        | Caller has no case access at all    |
| 404    | `{ "error": "Not found" }`                        | No case with that `id`              |
| 500    | `{ "error": "Failed to load attachments" }`       | Unexpected server error             |

### Example

```bash
curl -s \
  -H "Cookie: better-auth.session_token=<session-cookie>" \
  "http://localhost:3000/api/admin/escrow-cases/case-1/attachments"
```

---

## POST /api/admin/escrow-cases/[id]/attachments

**Auth:** `requireEscrowThreadWriteAccess(request, id)` — same as sending a
message: `admin`/`supervisor`/`own` may add evidence, the read-only
`"moderation"` scope is rejected with `403` (a moderator reviews evidence,
never adds to it).

### Request

`multipart/form-data`, not JSON:

| Field   | Type   | Required | Constraint                                          |
|---------|--------|----------|--------------------------------------------------------|
| `file`  | file   | yes      | One of the allowed evidence MIME types (below), ≤ 20 MB |
| `label` | string | no       | `.trim().max(200)` — a human-readable caption           |

Allowed MIME types (`ALLOWED_EVIDENCE_TYPES` in the route file — a subset
of `/api/chat/media`'s list, minus audio): `image/jpeg`, `image/png`,
`image/webp`, `image/gif`, `application/pdf`, `application/msword`,
`application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
Validated by MIME type, magic-byte signature, and size
(`validateUploadFile`, `lib/supabase/storage-upload.ts`) — the same
validator every upload route in this repo shares.

Uploads to the **`escrow-evidence`** Supabase Storage bucket
(`ESCROW_EVIDENCE_BUCKET`, `lib/supabase/server.ts`) — a dedicated bucket,
not `chat-media`, per this repo's one-bucket-per-domain convention (created
automatically on first upload via `createBucketIfMissing`).

This route creates an evidence record **not** linked to any message
(`messageId: null`) — it's for adding evidence directly (e.g. a future
standalone "add evidence" action), as opposed to attaching a file when
sending a chat message. See
[`docs/api/admin-escrow-cases-messages.md`](./admin-escrow-cases-messages.md)
for the message-attachment path, which creates its own linked evidence row
automatically — do not call both routes for the same file.

### Response

`200 OK`:

```json
{
  "success": true,
  "attachment": {
    "id": "att-2",
    "caseId": "case-1",
    "messageId": null,
    "uploadedByUserId": "usr_agent",
    "url": "https://.../evidence/agent-1/167...-uuid.pdf",
    "fileType": "file",
    "label": "Payment slip",
    "createdAt": "2026-09-16T00:05:00.000Z"
  }
}
```

#### Errors

| Status | Body                                                        | Cause                                                             |
|--------|-------------------------------------------------------------------|------------------------------------------------------------------------|
| 400    | `{ "error": "No file provided." }`                                 | No `file` field in the form data                                        |
| 400    | `{ "error": "Invalid input" }`                                     | `label` fails its schema (over 200 chars)                               |
| 400    | `{ "error": "Invalid file type: <name>. Allowed: ..." }`           | MIME type not in the allow-list                                         |
| 400    | `{ "error": "File too large: <name>. Max size: 20 MB" }`           | File exceeds 20 MB                                                       |
| 400    | `{ "error": "File content does not match declared type: <name>" }` | Magic-byte check failed (declared MIME doesn't match actual content)    |
| 401    | `{ "error": "Unauthorized. Sign in to upload files." }`            | No session (from `requireUploadContext`)                                |
| 401    | `{ "error": "Unauthorized" }`                                      | No session (from `requireEscrowThreadWriteAccess`, checked first)       |
| 403    | `{ "error": "Forbidden" }`                                         | Caller has no case access, or scope is `"moderation"`                   |
| 404    | `{ "error": "Not found" }`                                         | No case with that `id`                                                  |
| 503    | `{ "error": "..." }`                                               | Supabase admin client not configured (from `requireUploadContext`)       |
| 500    | `{ "error": "Failed to upload attachment" }`                       | Unexpected server error (including a real storage-layer failure)        |

### Example

```bash
curl -s -X POST \
  -H "Cookie: better-auth.session_token=<session-cookie>" \
  -F "file=@payment-slip.png;type=image/png" \
  -F "label=Payment slip" \
  "http://localhost:3000/api/admin/escrow-cases/case-1/attachments"
```
