# GET /api/admin/points/surprise-bonus/jobs

Background job queue status for the admin Surprise Bonus panel.

## Auth

Admin session with `credit.transactions` feature (or admin role).

## Response 200

```json
{
  "counts": { "pending": 1, "processing": 1, "completed": 40, "failed": 0, "stale": 1 },
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
      "campaignId": "camp-1",
      "campaignName": "Sweet December"
    }
  ]
}
```

`counts` covers every surprise-bonus job (not just the 100 most recent listed in `jobs`). `isStale` is `true` when `status = "processing"` and the job's lock is older than 3 minutes — the same window `claim_background_job` (migration `0087`) uses to reclaim it.

## Errors

- **401/403** — unauthorized

## Example

```bash
curl "http://localhost:3000/api/admin/points/surprise-bonus/jobs" \
  -H "Cookie: <admin-session>"
```

**Mobile:** no (admin only).

---

# POST /api/admin/points/surprise-bonus/jobs/retry

Runs one manual drain pass over the surprise-bonus queue — reclaims any job stranded `processing` (stale >3 min) and finishes due `pending` batches, without creating a new campaign. This is the same `drainSurpriseBonusJobs` function a Top-up submission runs inline.

## Auth

Admin session with `credit.transactions` feature (or admin role).

## Response 200

```json
{ "success": true, "batches": 2, "last": { "claimed": true, "campaignStatus": "completed", "...": "..." } }
```

`batches: 0` means the queue was already clear — nothing to do.

## Errors

- **401/403** — unauthorized
- **500** — `{ "error": "Retry failed: <message>" }` (e.g. missing RPCs)

## Example

```bash
curl -X POST "http://localhost:3000/api/admin/points/surprise-bonus/jobs/retry" \
  -H "Cookie: <admin-session>"
```

**Mobile:** no (admin only).
