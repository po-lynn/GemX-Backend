# POST /api/cron/surprise-bonus-push

Send FCM push to users who newly received a Surprise Bonus grant. Called by the Supabase Edge Function after each `surprise_bonus_batch` (and usable for manual retries).

**Auth:** `Authorization: Bearer $CRON_SECRET`  
**Mobile:** Indirect — devices must have registered via `POST /api/push/register`.

## Request

```json
{
  "userIds": ["user-uuid-1", "user-uuid-2"],
  "campaignId": "campaign-uuid",
  "campaignName": "Sweet December",
  "pointsPerUser": 500
}
```

| Field | Type | Required |
|-------|------|----------|
| `userIds` | string[] (1–500) | yes |
| `campaignId` | string | yes |
| `campaignName` | string | yes |
| `pointsPerUser` | positive int | yes |

## Response 200

```json
{
  "success": true,
  "sent": 3,
  "failed": 1,
  "invalidTokensRemoved": 0
}
```

## Errors

- **400** — validation
- **401** — bad/missing bearer
- **500** — `CRON_SECRET` unset or unexpected error

## Example

```bash
curl -X POST "http://localhost:3000/api/cron/surprise-bonus-push" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "userIds":["user-1"],
    "campaignId":"camp-1",
    "campaignName":"Sweet December",
    "pointsPerUser":500
  }'
```

**FCM data:** `type=surprise_bonus`, `screen=home`, `campaignId`, `points`.
