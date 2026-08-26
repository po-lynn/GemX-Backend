# Surprise Bonus — Database queue

## What changed

All Users top-up creates a **Surprise Bonus campaign** + **`background_jobs`** row.

| Environment | Who credits users + push |
|-------------|--------------------------|
| **Local/dev** (default) | Same HTTP request drains the queue via Drizzle + RPCs; FCM via `sendSurpriseBonusPushToUsers` |
| **Production** | Supabase Cron → Edge Function → RPCs; FCM via Next.js `POST /api/cron/surprise-bonus-push` |

| Path | Role |
|------|------|
| `drizzle/schema/surprise-bonus-schema.ts` | `surprise_bonus_campaign`, `background_jobs`, `app_notification`, `SURPRISE_BONUS_JOB_TYPE` |
| `drizzle/migrations/0081_surprise_bonus_queue.sql` | Tables, unique ledger index, RPCs |
| `features/points/db/surprise-bonus.ts` | Create campaign / enqueue job / progress |
| `features/points/services/enqueue-surprise-bonus.ts` | Orchestration; optional inline drain |
| `features/points/services/process-surprise-bonus-jobs.ts` | Node batch processor (mirrors Edge) |
| `features/points/services/surprise-bonus-push.ts` | FCM payload + send to user devices |
| `features/points/services/should-sync-process-surprise-bonus.ts` | Env gate for inline drain |
| `app/api/admin/points/surprise-bonus/route.ts` | `POST` create |
| `app/api/admin/points/surprise-bonus/[id]/route.ts` | `GET` progress |
| `app/api/cron/surprise-bonus-push/route.ts` | Edge → FCM proxy (`CRON_SECRET`) |
| `supabase/functions/process-background-jobs/index.ts` | Production batch worker |
| `features/points/components/PointActionButtons.tsx` | All Users → POST + poll progress |

## Data flow

```
Admin All Users submit
  → POST /api/admin/points/surprise-bonus
  → INSERT surprise_bonus_campaign + background_jobs (pending)
  → mark campaign processing

  Local/dev (or SURPRISE_BONUS_SYNC_PROCESS=true):
    → drainSurpriseBonusJobs()
      → claim_background_job()
      → grant_surprise_bonus_user() per user (≤100 / batch)
         (ledger + points + app_notification)
      → sendSurpriseBonusPushToUsers(newlyGranted)
      → next job or campaign completed
    → response { processedInline: true }

  Production (default):
    → 200 { processedInline: false }
    → pg_cron / Supabase Cron
      → Edge Function process-background-jobs (same RPC logic)
      → POST {APP_URL}/api/cron/surprise-bonus-push (FCM)
```

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
| `SURPRISE_BONUS_SYNC_PROCESS=true` | Always drain inline after enqueue |
| `SURPRISE_BONUS_SYNC_PROCESS=false` | Never drain inline (Cron only) |
| unset | Inline when `NODE_ENV !== "production"` |
| `FIREBASE_*` | Required for FCM (local + cron route) |
| `CRON_SECRET` | Cron push route + Edge inbound/outbound |
| `APP_URL` (Edge secret) | Next.js origin for FCM proxy from Edge |

## Edge cases

- **Local migrate:** `GRANT ... TO service_role` runs only when that role exists (Supabase hosted Postgres). Local app uses the DB owner role for RPCs.
- Duplicate grant → unique violation → `already_granted` (no double credit, no second push)
- Per-user errors increment `failed_count`; campaign continues
- Job retries with `available_at` backoff until `max_attempts`
- FCM failure does not undo ledger / `app_notification`
- Users without `user_devices` tokens: in-app row only
- Large local All Users may hit Postgres `statement_timeout` (15s on direct connections) — use Cron path or raise timeout
- No Redis / BullMQ / Next.js worker process
