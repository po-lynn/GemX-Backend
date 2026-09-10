# GET/POST /api/admin/queue

## GET /api/admin/queue

**Auth:** Admin session, or internal session with the `queue_management` RBAC permission (`requireAdminOrFeature`).

**Query params:** `type` (optional) — a registered job type's identifier.

**Response — no `type`:**
```json
{
  "types": [
    { "type": "surprise_bonus_batch", "label": "Surprise Bonus", "counts": { "pending": 1, "processing": 0, "completed": 40, "failed": 0, "stale": 0 } }
  ]
}
```

**Response — with `type`:**
```json
{
  "types": [{ "type": "surprise_bonus_batch", "label": "Surprise Bonus" }],
  "selectedType": "surprise_bonus_batch",
  "counts": { "pending": 1, "processing": 0, "completed": 40, "failed": 0, "stale": 0 },
  "jobs": [
    {
      "id": "job-1",
      "status": "processing",
      "isStale": true,
      "attempts": 1,
      "maxAttempts": 5,
      "availableAt": "2026-09-08T09:59:00.000Z",
      "lockedAt": "2026-09-08T10:00:00.000Z",
      "lockedBy": "local-abc123",
      "lastError": null,
      "createdAt": "2026-09-08T09:58:00.000Z",
      "completedAt": null,
      "description": "Sweet December"
    }
  ]
}
```

**Errors:** `401` unauthorized, `403` forbidden, `404` unknown `type`.

**Example:**
```bash
curl -H "Cookie: better-auth.session_token=..." \
  "https://<host>/api/admin/queue?type=surprise_bonus_batch"
```

**Mobile flag:** not used by the mobile app — admin-only.

## POST /api/admin/queue/retry

**Auth:** same as `GET`.

**Body:**
```json
{ "type": "surprise_bonus_batch" }
```

**Response (200):**
```json
{ "success": true, "batches": 2 }
```

**Errors:** `400` missing `type`, `401` unauthorized, `403` forbidden, `404` unknown `type`, `500` when the drain throws (`{ "error": "Retry failed: <message>" }`).

**Example:**
```bash
curl -X POST -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=..." \
  -d '{"type":"surprise_bonus_batch"}' \
  "https://<host>/api/admin/queue/retry"
```

**Mobile flag:** not used by the mobile app — admin-only.
