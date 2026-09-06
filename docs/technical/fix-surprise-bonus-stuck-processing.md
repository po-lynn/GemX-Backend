# Fix: All Users Top-up stuck on Processing (0 processed) on Vercel

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

After deploy, either:

```bash
curl -X POST "https://YOUR_HOST/api/cron/process-surprise-bonus" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Or run another All Users Top-up (inline drain also claims older pending jobs).

## Auth

Unchanged (`CREDIT_TRANSACTIONS` / `CRON_SECRET` for cron).

## Edge cases

- Missing RPCs → API returns error string containing `crediting failed` (check migration `0081`).
- `SURPRISE_BONUS_SYNC_PROCESS=false` on Vercel without working cron → stuck again; do not set false unless cron is verified.
- Very large user bases may hit 60s `maxDuration` — then set `=false` and rely on minutely cron.
