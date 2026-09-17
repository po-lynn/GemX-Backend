# /api/admin/escrow-canned-responses/[id]

`PATCH` (update) and `DELETE` (remove). Route file:
`app/api/admin/escrow-canned-responses/[id]/route.ts`.

**Mobile flag:** Not consumed by the mobile app — admin-only.

---

## PATCH /api/admin/escrow-canned-responses/[id]

**Auth:** `requireAdminOrFeature(request, FEATURE_KEYS.ESCROW_CASES)` — same
as the collection routes.

### Request

Path params:

| Param | Type   | Required | Notes                                  |
|-------|--------|----------|-------------------------------------------|
| `id`  | string | yes      | Canned response id (`escrow_canned_response.id`) |

Body — `updateSchema`, all fields optional but at least one required:

| Field       | Type    | Constraint                  |
|-------------|---------|----------------------------------|
| `title`     | string  | `.trim().min(1).max(200)`          |
| `bodyEn`    | string  | `.trim().min(1).max(2000)`         |
| `bodyMy`    | string  | `.trim().min(1).max(2000)`         |
| `isActive`  | boolean | —                                    |
| `sortOrder` | number  | integer                              |

The admin config page's "Active/Disabled" toggle sends `{ "isActive": ... }`
alone — a partial update, not a full re-save of the template.

### Response

`200 OK`, the updated row under `response` (same shape as
[`docs/api/admin-escrow-canned-responses.md`](./admin-escrow-canned-responses.md)'s
`GET` entries), with `updatedAt` refreshed.

#### Errors

| Status | Body                                             | Cause                          |
|--------|--------------------------------------------------------|-----------------------------------|
| 400    | `{ "error": "Invalid input" }`                            | Malformed body, or a field fails its constraint |
| 400    | `{ "error": "No fields to update" }`                      | Empty body (`{}`)                    |
| 401    | `{ "error": "Unauthorized" }`                             | No session                          |
| 403    | `{ "error": "Forbidden" }`                                | Missing the `ESCROW_CASES` key      |
| 404    | `{ "error": "Not found" }`                                | No canned response with that `id`   |
| 500    | `{ "error": "Failed to update canned response" }`         | Unexpected server error             |

### Example

```bash
curl -s -X PATCH \
  -H "Cookie: better-auth.session_token=<session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{"isActive":false}' \
  "http://localhost:3000/api/admin/escrow-canned-responses/resp-1"
```

---

## DELETE /api/admin/escrow-canned-responses/[id]

**Auth:** same as `PATCH` above. A real hard delete — there's no soft-
delete/archive state for canned responses (use `PATCH { isActive: false }`
to disable one without losing it).

### Response

`200 OK`: `{ "success": true }`

#### Errors

| Status | Body                                             | Cause                          |
|--------|--------------------------------------------------------|-----------------------------------|
| 401    | `{ "error": "Unauthorized" }`                             | No session                          |
| 403    | `{ "error": "Forbidden" }`                                | Missing the `ESCROW_CASES` key      |
| 404    | `{ "error": "Not found" }`                                | No canned response with that `id`   |
| 500    | `{ "error": "Failed to delete canned response" }`         | Unexpected server error             |

### Example

```bash
curl -s -X DELETE \
  -H "Cookie: better-auth.session_token=<session-cookie>" \
  "http://localhost:3000/api/admin/escrow-canned-responses/resp-1"
```
