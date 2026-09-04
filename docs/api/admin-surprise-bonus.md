# enqueueSurpriseBonusAction (server action)

`features/points/actions/points.ts` — creates a Surprise Bonus campaign for all active users and
enqueues the first database job. Called directly from the client component
(`PointActionButtons.tsx`), not via `fetch`.

- **Local/dev:** drains pending jobs in this call (`processedInline: true`) unless `SURPRISE_BONUS_SYNC_PROCESS=false`.
- **Production:** returns after enqueue; Edge Cron credits users (`processedInline: false`).

## Auth

Admin session, or internal session holding the `credit.transactions` (`FEATURE_KEYS.CREDIT_TRANSACTIONS`) feature key. Checked via a local `requireCreditTransactionsSession` helper (same `checkInternalAccess` RBAC path as `lib/api-guard.ts`'s `requireAdminOrFeature`, since server actions read the cookie session via `next/headers` rather than a `NextRequest`).

## Signature

```ts
enqueueSurpriseBonusAction(
  campaignName: string,
  pointsPerUser: number,
  note?: string,
): Promise<
  | { success: true; campaignId: string; totalUsers: number; pointsPerUser: number; campaignName: string }
  | { error: string }
>
```

## Errors

- `{ error: "Unauthorized" }` — no session, or internal session lacking the feature key
- `{ error: "..." }` — validation failure or no active users, from `enqueueSurpriseBonusForAllUsers` (e.g. "Amount must be a positive number.", "Campaign name is required.", "No active users found.")

## Example

```ts
const result = await enqueueSurpriseBonusAction("Sweet December", 500, "Optional note")
if ("error" in result) {
  toast.error(result.error)
} else {
  // result.campaignId feeds the GET poll below
}
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
