# PATCH /api/admin/escrow-cases/[id]/read

Route file: `app/api/admin/escrow-cases/[id]/read/route.ts`. Marks the
caller's own read cursor for a case thread.

**Auth:** `requireEscrowCaseAccess(request, id)` — the same four-scope check
as `GET /api/admin/escrow-cases/[id]` (see
[`docs/api/admin-escrow-cases-detail.md`](./admin-escrow-cases-detail.md)):
`admin`, `supervisor`, `own` (assigned agent), or **`moderation`**. Unlike
`POST .../messages`, this route does **not** call
`requireEscrowThreadWriteAccess` and does **not** reject the `moderation`
scope — per the route's own comment, this endpoint "marks the caller's own
read cursor; never affects another viewer's unread state, so any access
scope (including moderation) may call this for themselves."

**Mobile flag:** Not consumed by the mobile app — admin-only.

## Request

Path params:

| Param | Type   | Required | Notes                  |
|-------|--------|----------|--------------------------|
| `id`  | string | yes      | Escrow case id (`escrow_case.id`) |

No query params. No request body is read or parsed by this route.

## Response

`200 OK`:

```json
{ "success": true }
```

**Side effects:**

- `markEscrowCaseRead(id, userId)` — upserts
  `escrow_case_read_cursor(case_id, user_id)`, setting `last_read_at = now()`
  on conflict (`onConflictDoUpdate` on the `(caseId, userId)` target).
- `broadcastCaseEvents(id, [{ event: "case_read_update", payload: { caseId, userId, lastReadAt } }])`
  — fire-and-forget Supabase Realtime broadcast; `.catch`-logged to
  `console.error` and never affects the response. `lastReadAt` in the
  broadcast payload is computed client-side in the route (`new
  Date().toISOString()`) at request time, not re-read from the DB row just
  written.

### Errors

| Status | Body                                       | Cause                                                    |
|--------|------------------------------------------------|-------------------------------------------------------------|
| 401    | `{ "error": "Unauthorized" }`                  | No session                                                    |
| 403    | `{ "error": "Forbidden" }`                     | Caller has none of the four access scopes                    |
| 404    | `{ "error": "Not found" }`                     | No case with that `id`                                        |
| 500    | `{ "error": "Failed to mark case read" }`      | Unexpected server error                                        |

## Example

```bash
curl -s -X PATCH \
  -H "Cookie: better-auth.session_token=<session-cookie>" \
  "http://localhost:3000/api/admin/escrow-cases/case-1/read"
```
