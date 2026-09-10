# Surprise Bonus — Database queue

## What changed

All Users top-up creates a **Surprise Bonus campaign** + **`background_jobs`** row.

Surprise Bonus is **admin-triggered only, inline-only** — no schedule, no cron, no background worker. An admin clicks Top-up → All Users whenever they want to run a campaign, and that request drains the whole queue before responding.

| Path | Role |
|------|------|
| `drizzle/schema/surprise-bonus-schema.ts` | `surprise_bonus_campaign`, `app_notification`, `SURPRISE_BONUS_JOB_TYPE` |
| `drizzle/schema/queue-schema.ts` | `background_jobs` — generic queue table, shared with any other lib/queue consumer |
| `drizzle/migrations/0081_surprise_bonus_queue.sql` | Tables, unique ledger index, RPCs |
| `drizzle/migrations/0087_reclaim_stale_surprise_bonus_jobs.sql` | `claim_background_job` also reclaims stale `processing` jobs |
| `lib/queue/` | Generic claim/retry/drain/admin-listing core — see [queue-management.md](./queue-management.md) |
| `features/points/db/surprise-bonus.ts` | Create campaign / progress / `describeSurpriseBonusJobs` (admin panel enrichment) |
| `features/points/services/enqueue-surprise-bonus.ts` | Orchestration; always drains inline via `lib/queue` |
| `features/points/services/process-surprise-bonus-jobs.ts` | `processSurpriseBonusJob` — the registered `lib/queue` handler for `SURPRISE_BONUS_JOB_TYPE` |
| `features/points/services/surprise-bonus-push.ts` | FCM payload + send to user devices |
| `app/api/admin/points/surprise-bonus/route.ts` | `POST` create + drain (`maxDuration = 60`) |
| `app/api/admin/points/surprise-bonus/[id]/route.ts` | `GET` — audit a past campaign's counts (not used for polling) |
| `app/api/cron/surprise-bonus-push/route.ts` | FCM proxy for the optional Supabase Edge Function path (`CRON_SECRET`) |
| `supabase/functions/process-background-jobs/index.ts` | **Optional** standalone worker — not required, most deployments don't run it |
| `features/points/components/PointActionButtons.tsx` | All Users → POST, shows the completed result |

Queue visibility (status counts, recent jobs, "Retry stuck jobs") moved
from a dedicated embedded panel to the unified
[`/admin/queue`](../guides/queue-management.md) page — see
[surprise-bonus-jobs-panel.md](./surprise-bonus-jobs-panel.md) for the
superseded version.

## Data flow

```
Admin clicks Top-up → All Users → submit
  → POST /api/admin/points/surprise-bonus
  → INSERT surprise_bonus_campaign + background_jobs (pending)
  → mark campaign processing
  → drainSurpriseBonusJobs() (same request, same function invocation)
      → claim_background_job() — due 'pending' OR stale 'processing' (>3 min locked, migration 0087)
      → grant_surprise_bonus_user() per user (≤100 / batch)
         (ledger + points + app_notification)
      → sendSurpriseBonusPushToUsers(newlyGranted)
      → next job or campaign completed
  → response { processedInline: true }
  → if drain throws: campaign row still exists (uncredited); response returns { error }
  → if a batch is cut off by maxDuration (huge campaigns): job stays 'processing';
    the *next* Top-up submission's claim_background_job reclaims it (>3 min stale)
```

There is no cron and nothing runs between Top-up submissions. The optional Supabase Edge Function (`process-background-jobs`) can drain the same `background_jobs` queue independently if someone deploys and schedules it, but nothing in the app relies on it.

## Notifications

| Channel | When |
|---------|------|
| `app_notification` row | Inside `grant_surprise_bonus_user` (always on grant) |
| FCM push | After batch, only for `granted: true` (not `already_granted`) |

Push payload: title `{campaignName} 🎁`, body `You received {N} surprise bonus points!`, data `type=surprise_bonus`, `screen=home`, `campaignId`, `points`.

## Schema impact

- New tables: `surprise_bonus_campaign`, `background_jobs`, `app_notification`
- Unique index `pt_user_type_ref_uidx` on `point_transaction (user_id, type, reference_id) WHERE reference_id IS NOT NULL`
- Ledger: `type=surprise_bonus`, `reference_type=surprise_bonus_campaign`, `reference_id=campaignId`
- RPCs: `claim_background_job`, `grant_surprise_bonus_user`

## Auth

Admin APIs: `requireAdminOrFeature(..., CREDIT_TRANSACTIONS)`.

Edge Function: service role + optional `CRON_SECRET` Bearer.

Push cron: `Authorization: Bearer $CRON_SECRET`.

## Env

| Variable | Effect |
|----------|--------|
| `FIREBASE_*` | Required for FCM |
| `CRON_SECRET` | Only needed for the unrelated `monthly-bonus-points` cron and the `surprise-bonus-push` FCM proxy (used by the optional Supabase Edge Function path) — not required for Surprise Bonus itself |

## Edge cases

- **Local migrate:** `GRANT ... TO service_role` runs only when that role exists (Supabase hosted Postgres). Local app uses the DB owner role for RPCs.
- Duplicate grant → unique violation → `already_granted` (no double credit, no second push)
- Per-user errors increment `failed_count`; campaign continues
- Job retries with `available_at` backoff until `max_attempts`
- FCM failure does not undo ledger / `app_notification`
- Users without `user_devices` tokens: in-app row only
- A user base large enough to exceed `maxDuration` (60s) strands its in-flight batch at `status = 'processing'`; the next Top-up submission (of any size) reclaims it via migration `0087` — there's no automatic continuation between submissions
- No Redis / BullMQ / Next.js worker process, no cron
