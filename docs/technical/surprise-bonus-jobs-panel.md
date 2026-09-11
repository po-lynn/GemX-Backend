# Surprise Bonus — Background Jobs admin panel

> **Update (later cleanup):** this dedicated panel and its two routes
> (`app/api/admin/points/surprise-bonus/jobs/route.ts`,
> `.../jobs/retry/route.ts`) have been removed. Queue visibility for
> Surprise Bonus — and every other queue-backed feature — now lives on the
> unified `/admin/queue` page; see
> [queue-management.md](./queue-management.md). The mechanics described
> below (status counts, `isStale` computation, "Retry stuck jobs" running a
> real drain pass) are unchanged, just generalized and moved.

## What changed and why

Surprise Bonus is admin-triggered and inline-only, with no cron (see
[surprise-bonus-queue.md](./surprise-bonus-queue.md)). That means the only way
an admin could previously tell whether a campaign's `background_jobs` queue was
healthy, stuck, or actively draining was to read the database directly. This
adds a visibility + manual-recovery panel to the admin UI so that's no longer
necessary.

### Files touched

| Path | Change |
|------|--------|
| `features/points/db/surprise-bonus.ts` | `listSurpriseBonusJobs()` (recent jobs + campaign name, `isStale` flag) and `getSurpriseBonusJobStatusCounts()` (grouped status counts, including a stale count) |
| `app/api/admin/points/surprise-bonus/jobs/route.ts` | `GET` — counts + recent jobs |
| `app/api/admin/points/surprise-bonus/jobs/retry/route.ts` | `POST` — runs one `drainSurpriseBonusJobs` pass on demand (`maxBatches: 50`) |
| `features/points/components/SurpriseBonusJobsPanel.tsx` | Client panel: stat chips, job table, Refresh + "Retry stuck jobs" buttons |
| `app/admin/credit/transactions/page.tsx` | Renders the panel below the transactions table |
| `components/admin/list-view/StatusPill.tsx` | Added `processing` / `completed` labels |
| `app/admin-list-view.css` | Added `.lv-status.processing` / `.lv-status.completed` |

## Data flow

```
Panel mounts → GET /api/admin/points/surprise-bonus/jobs
  → getSurpriseBonusJobStatusCounts() — one grouped COUNT(*) FILTER query
  → listSurpriseBonusJobs(100) — recent background_jobs LEFT JOIN
    surprise_bonus_campaign on payload->>'campaignId', newest first
  → each row's isStale = status = 'processing' AND locked_at older than
    3 minutes (mirrors claim_background_job's reclaim window, migration 0087)

Admin clicks "Retry stuck jobs" → POST .../jobs/retry
  → drainSurpriseBonusJobs({ maxBatches: 50 }) — same function Top-up uses inline
  → reclaims stale rows + finishes any due pending batches
  → panel refetches to show the new state
```

The `isStale` flag is computed in JS at read time (`Date.now() - lockedAt`),
not stored — it always reflects "would `claim_background_job` reclaim this
right now," matching the actual reclaim condition in migration `0087` exactly.

## Schema impact

None. Both new DB functions only read `background_jobs` / `surprise_bonus_campaign`; no migration.

## Auth & permissions

Both routes: `requireAdminOrFeature(request, FEATURE_KEYS.CREDIT_TRANSACTIONS)` — same gate as the rest of the Surprise Bonus admin surface.

## Edge cases & known limitations

- `campaignId` is read out of the job's `jsonb` payload (`payload->>'campaignId'`) for the `LEFT JOIN` — there's no FK column, so a job for a deleted/unknown campaign still lists (with `campaignName: null`).
- The retry button runs a real drain pass, not a dry-run preview — if the queue has genuine pending work (not just stale rows), clicking it credits users, same as it would if triggered by another Top-up.
- `isStale` uses the same fixed 3-minute threshold as the SQL reclaim function; if that threshold is ever changed in the migration, update `STALE_AFTER_MS` in `features/points/db/surprise-bonus.ts` to match.
