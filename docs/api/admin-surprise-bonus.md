# POST /api/admin/points/surprise-bonus

Create a Surprise Bonus campaign for all active users and enqueue the first database job.

Drains the queue **inline in this request**, in every environment — the response is only sent once all users are credited (`processedInline: true`). There is no background worker or cron for this endpoint. If a very large user base gets cut off by `maxDuration` (60s) mid-drain, the stranded job is auto-reclaimed by the *next* Top-up submission's inline drain once its lock is >3 min old (`claim_background_job`, migration `0087`) — see [surprise-bonus-stale-job-reclaim.md](../technical/surprise-bonus-stale-job-reclaim.md).

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

Look up a campaign's final counts (e.g. to audit an old campaign). Not used for polling — the POST response above already reflects the completed state, since draining happens inline before it returns.

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
