# Fix: All Users Top-up stuck on Processing (0 processed) on Vercel

> **Update (later cleanup):** Surprise Bonus is admin-triggered only, with no automated monthly/recurring schedule — the admin clicks Top-up whenever they want to run a campaign. Since there was never a scheduling need, the `SURPRISE_BONUS_SYNC_PROCESS` async opt-out, the `after()` drain, and `/api/cron/process-surprise-bonus` (points 1 and 6 below, and the cron kick in point 2's file list) were removed entirely — see [surprise-bonus-queue.md](./surprise-bonus-queue.md). Everything below describes the state before that cleanup; the inline-drain mechanism it introduced (points 2-5) is unchanged and is now the *only* path.

## What changed and why

Screenshot symptom: campaign **Status: processing**, **Processed: 0 / 40**, Success/Failed 0 — queue created, nothing credited.

**Cause:** Production default skipped inline drain (`shouldSyncProcessSurpriseBonus` was false when `NODE_ENV=production`). Work depended on `after()` and/or Vercel/Edge cron, which often never ran → forever `processing`.

### Fix

1. **Default to inline drain** always (including production) unless `SURPRISE_BONUS_SYNC_PROCESS=false`.
2. Inline drain **errors are returned to the admin** (no fake success + stuck campaign).
3. Admin route `maxDuration = 60` so ~40–few hundred users can finish in one request.
4. UI shows **completed** immediately when `processedInline: true`.
5. Harden `db.execute` row parsing (`asRows`) for claim/grant RPCs.
6. Keep `/api/cron/process-surprise-bonus` to clear **older stuck** jobs and large async opt-out runs.

### Files

| Path | Change |
|------|--------|
| `features/points/services/should-sync-process-surprise-bonus.ts` | Default `true` |
| `features/points/services/enqueue-surprise-bonus.ts` | Await drain; surface errors; cron kick when async |
| `features/points/services/process-surprise-bonus-jobs.ts` | `asRows()` helper |
| `app/api/admin/points/surprise-bonus/route.ts` | `maxDuration = 60` |
| `features/points/components/PointActionButtons.tsx` | Treat inline as completed in UI |

## Data flow (Vercel default)

```
Top-up All Users
  → create campaign + pending job + status=processing
  → drainSurpriseBonusJobs() in same request
  → status=completed, processed=N
  → 200 { processedInline: true }
  → drawer shows completed
```

## Unstick existing “6- Sep” campaign

Run another All Users Top-up — its inline drain claims older pending/stale jobs first.

## Auth

`CREDIT_TRANSACTIONS` for the admin route. `CRON_SECRET` is unrelated to Surprise Bonus now (only `monthly-bonus-points` and the optional Edge Function's push proxy use it).

## Edge cases

- Missing RPCs → API returns error string containing `crediting failed` (check migration `0081`).
- Very large user bases may hit 60s `maxDuration` mid-batch, stranding a job `processing`. Migration `0087` reclaims it automatically once its lock is >3 min old — submit any Top-up again to pick it back up. See [surprise-bonus-stale-job-reclaim.md](./surprise-bonus-stale-job-reclaim.md).
