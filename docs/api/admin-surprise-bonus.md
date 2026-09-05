# POST /api/admin/points/surprise-bonus

Create a Surprise Bonus campaign for all active users and enqueue the first database job.

- **Local/dev:** drains pending jobs in this request (`processedInline: true`) unless `SURPRISE_BONUS_SYNC_PROCESS=false`.
- **Production:** returns after enqueue; Edge Cron credits users (`processedInline: false`).

## Auth

Admin session with `credit.transactions` feature (or admin role).

## Request

```json
{
  "campaignName": "Sweet December",
  "pointsPerUser": 500,
  "note": "Optional note"
}
```

| Field | Type | Required |
|-------|------|----------|
| `campaignName` | string | yes |
| `pointsPerUser` | positive int | yes |
| `note` | string | no |

## Response 200

```json
{
  "success": true,
  "campaignId": "uuid",
  "totalUsers": 1256,
  "pointsPerUser": 500,
  "campaignName": "Sweet December",
  "processedInline": true
}
```

| Field | Meaning |
|-------|---------|
| `processedInline` | `true` if this request drained the queue and credited users |

## Errors

- **400** — validation / no active users
- **401/403** — unauthorized
- **500** — inline drain failure (e.g. missing RPC)

## Example

```bash
curl -X POST "http://localhost:3000/api/admin/points/surprise-bonus" \
  -H "Content-Type: application/json" \
  -H "Cookie: <admin-session>" \
  -d '{"campaignName":"Sweet December","pointsPerUser":500}'
```

**Mobile:** no (admin only).

---

# GET /api/admin/points/surprise-bonus/[id]

Campaign progress for admin polling.

## Response 200

```json
{
  "id": "uuid",
  "name": "Sweet December",
  "pointsPerUser": 500,
  "recipientType": "all_users",
  "totalUsers": 10000,
  "processedUsers": 6500,
  "successCount": 6490,
  "failedCount": 10,
  "status": "processing",
  "startedAt": "...",
  "completedAt": null,
  "createdAt": "...",
  "updatedAt": "..."
}
```

**Mobile:** no (admin only).
