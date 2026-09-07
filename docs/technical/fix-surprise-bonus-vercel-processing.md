# Fix: Surprise Bonus stuck on Processing (Vercel)

> **Update (later cleanup):** everything this doc describes — the `after()` drain, `/api/cron/process-surprise-bonus`, its `vercel.json` entry, and `SURPRISE_BONUS_SYNC_PROCESS` — has since been **removed entirely**. Surprise Bonus is admin-triggered whenever an admin wants to run a campaign, with no recurring schedule, so there was no need to keep a cron around; the inline drain (already the default by the time of this doc) is now the only path. See [surprise-bonus-queue.md](./surprise-bonus-queue.md).

## What changed and why

All Users Top-up on **Vercel production** created a campaign with `status: processing` and a `background_jobs` row, then returned. Credits only ran if a **Supabase Edge Function** cron was deployed — which often was not. The admin UI stayed on **Processing**.

### Fix

1. **`after()` drain** in `enqueueSurpriseBonusForAllUsers` when sync-inline is off (production default): start draining after the HTTP response so small/medium campaigns complete without waiting for cron.
2. **Vercel Cron** `GET|POST /api/cron/process-surprise-bonus` every minute — continues / finishes large campaigns if `after()` is cut short.
3. Supabase Edge Function remains optional, not required for Vercel.

### Files touched

| Path | Change |
|------|--------|
| `features/points/services/enqueue-surprise-bonus.ts` | Schedule `drainSurpriseBonusJobs` via `after()` in production |
| `app/api/cron/process-surprise-bonus/route.ts` | New drain cron (GET+POST, `CRON_SECRET`) |
| `vercel.json` | Cron `* * * * *` → `/api/cron/process-surprise-bonus` |
| `app/api/admin/points/surprise-bonus/route.ts` | Comment update |
| `.env.example` | Document Vercel cron path |
| `tests/api/cron/process-surprise-bonus.test.ts` | Auth + drain |
| `tests/unit/enqueue-surprise-bonus-after.test.ts` | after() vs inline |

## Data flow

```
Admin Top-up All Users (production)
  → POST /api/admin/points/surprise-bonus
  → campaign + background_jobs + status=processing
  → 200 { scheduledAfterResponse: true }
  → after() → drainSurpriseBonusJobs (best effort)
  → Vercel cron each minute → same drain (backup / large campaigns)
  → campaign status=completed
  → admin drawer poll sees completed
```

## Schema impact

None.

## Auth & permissions

- Admin create: `CREDIT_TRANSACTIONS` (unchanged)
- Cron: `Authorization: Bearer $CRON_SECRET`

## Edge cases & known limitations

- Ensure `CRON_SECRET` is set in Vercel project env (required for cron auth).
- ~~Hobby plans may not allow `* * * * *`~~ — **confirmed**: Hobby fails deployment on anything more frequent than daily, not just degrades. `vercel.json` now schedules this cron `0 2 * * *`; see [surprise-bonus-stale-job-reclaim.md](./surprise-bonus-stale-job-reclaim.md) and [fix-surprise-bonus-stuck-processing.md](./fix-surprise-bonus-stuck-processing.md) for the follow-up fixes (inline-by-default + stale-job reclaim) that made a once-daily backstop cron acceptable.
- Very large user bases may need several cron ticks (50 batches × 100 users ≈ 5k users/tick).
- `SURPRISE_BONUS_SYNC_PROCESS` now defaults to inline drain in **every** environment, not just non-production — see the follow-up docs linked above.
