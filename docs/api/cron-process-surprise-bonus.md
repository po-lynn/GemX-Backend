# Cron: Process Surprise Bonus queue

**Endpoint:** `GET|POST /api/cron/process-surprise-bonus`  
**Auth:** `Authorization: Bearer $CRON_SECRET`  
**Mobile flag:** no (internal cron); credits + FCM side effects are consumed by the mobile app  
**Schedule:** every minute via `vercel.json` (`* * * * *`)

## Behavior

Drains pending `background_jobs` rows with `type = surprise_bonus_batch` (All Users Top-up / Surprise Bonus).

- Claims up to **50 batches** per invocation (≤100 users each).
- Each grant writes `point_transaction` (`type: surprise_bonus`) + `app_notification`, then FCM via `sendSurpriseBonusPushToUsers`.
- Marks the campaign `completed` when no users remain.
- Complements production `after()` drain started by `enqueueSurpriseBonusForAllUsers` when the request cannot finish large campaigns alone.

Requires migration RPCs `claim_background_job` / `grant_surprise_bonus_user` and `CRON_SECRET` on Vercel (Vercel Cron attaches the Bearer header automatically when `CRON_SECRET` is set).

## Response 200 (example)

```json
{
  "success": true,
  "batches": 2,
  "last": {
    "claimed": true,
    "jobId": "…",
    "campaignId": "…",
    "batchSize": 100,
    "successDelta": 100,
    "failedDelta": 0,
    "hasMore": false,
    "campaignStatus": "completed"
  }
}
```

When the queue is empty: `{ "success": true, "batches": 0, "last": null }`.

## Errors

- `401 Unauthorized` — bad/missing bearer
- `500 Cron not configured` — missing `CRON_SECRET`
- `500 Internal server error` — unexpected failure

## Example

```bash
curl -X POST "https://your-host/api/cron/process-surprise-bonus" \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Mobile flag

No — admin/cron only.
