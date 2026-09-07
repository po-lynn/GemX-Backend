# Fix: Surprise Bonus queue stuck at 0 processed on production

## What changed and why

The Surprise Bonus ("Top-up → All Users") queue drains `background_jobs` rows
via `claim_background_job()`, a Postgres RPC that atomically claims one
`status = 'pending'` job with `FOR UPDATE SKIP LOCKED` (see
[surprise-bonus-queue.md](./surprise-bonus-queue.md) and the earlier
[fix-surprise-bonus-vercel-processing.md](./fix-surprise-bonus-vercel-processing.md)).

In production, a batch is drained either by `after()` inside the
`POST /api/admin/points/surprise-bonus` request, or by the
`/api/cron/process-surprise-bonus` Vercel Cron tick. Both run as ordinary
serverless function invocations subject to `maxDuration`. If the platform
kills the function mid-batch (timeout, cold-start crash, OOM), the JS
try/catch in `processOneSurpriseBonusBatch` never runs — the process is
terminated, not thrown an exception — so `failOrRetryJob()` never fires and
the claimed job is left with `status = 'processing'` forever.

`claim_background_job()` only ever selected `status = 'pending'` rows, so an
orphaned `processing` job became permanently invisible to every future claim
attempt: not the next `after()` drain, not the next cron tick. The campaign
progress (`processed_users` / `success_count` / `failed_count`) is only
written *after* a batch's loop finishes, so an interrupted batch leaves the
campaign showing `0 / N processed` — matching the reported symptom — with no
error surfaced anywhere the admin can see (the failure is a killed function,
not a caught exception, so it never reaches `console.error` either).

This reproduces reliably on any host that enforces a function execution
limit (Vercel serverless/Hobby/Pro all do); it does not reproduce with
`next dev` locally, where the same code runs as a long-lived Node process
with no timeout — hence "works locally, stuck on the server."

### Fix

`claim_background_job()` (migration
`drizzle/migrations/0087_reclaim_stale_surprise_bonus_jobs.sql`) now also
claims jobs where `status = 'processing' AND locked_at < now() - interval '3 minutes'`,
in addition to due `pending` jobs:

```sql
WHERE j.type = p_type
  AND (
    (j.status = 'pending' AND j.available_at <= now())
    OR (j.status = 'processing' AND j.locked_at < now() - interval '3 minutes')
  )
```

3 minutes is comfortably longer than a single ≤100-user batch takes, so a
genuinely healthy in-flight batch is never reclaimed out from under itself;
a killed one is picked back up by the next `after()` drain or cron tick
instead of staying orphaned forever. `grant_surprise_bonus_user()` is already
idempotent per `(user_id, campaign_id)` via the unique index on
`point_transaction`, so the rare case of a reclaim racing a still-running
batch cannot double-credit a user — the loser's insert hits `already_granted`
and is skipped.

`app/api/admin/points/surprise-bonus/route.ts` also now sets
`export const maxDuration = 60` (matching the cron route) so the `after()`
drain gets the same execution budget as the cron path on plans that allow it,
reducing how often a batch gets killed in the first place.

### Files touched

| Path | Change |
|------|--------|
| `drizzle/migrations/0087_reclaim_stale_surprise_bonus_jobs.sql` | New migration: `claim_background_job()` reclaims stale `processing` jobs |
| `scripts/surprise-bonus-rpcs.sql` | Manual Supabase SQL editor copy updated to match |
| `app/api/admin/points/surprise-bonus/route.ts` | Added `maxDuration = 60` |
| `docs/guides/admin-top-up.md` | Troubleshooting entry + migration prerequisite |
| `tests/unit/surprise-bonus-stale-job-reclaim.test.ts` | Asserts the reclaim clause is present in both SQL copies |

## Data flow

```
after() or cron calls claim_background_job('surprise_bonus_batch', workerId)
  → claims due 'pending' rows (unchanged)
  → OR claims 'processing' rows whose locked_at is > 3 min old (new)
  → processOneSurpriseBonusBatch() grants up to 100 users, updates campaign counters
  → if interrupted mid-batch: row stays 'processing' with a fresh locked_at
    from *this* claim, so it is only reclaimed again after another 3 min of
    silence — bounding retries instead of hot-looping
```

## Schema impact

None — no table/column changes, only a `CREATE OR REPLACE FUNCTION` on the
existing `claim_background_job(text, text)` RPC. Apply with `npm run db:migrate`
(or paste `scripts/surprise-bonus-rpcs.sql` into the Supabase SQL editor).

## Auth & permissions

Unchanged — admin create still requires `CREDIT_TRANSACTIONS`; cron drain
still requires `Authorization: Bearer $CRON_SECRET`.

## Edge cases & known limitations

- A campaign interrupted right as the reclaim window fix is deployed still
  needs one more claim cycle (next cron tick, within 1 minute) to notice the
  stale lock — it is not instant, but it is now bounded and automatic instead
  of infinite.
- Vercel Hobby plans still cap Cron to once/day; `after()` plus this reclaim
  fix reduces reliance on frequent cron ticks but does not require a plan
  upgrade to make small/medium campaigns (a handful of batches) eventually
  complete, since the *next* Top-up's `after()` or a later cron tick will
  also claim any stale row for the type.
- 3 minutes is a fixed threshold; a pathological single batch that legitimately
  takes longer (e.g. FCM provider degraded) could be double-claimed. This is
  safe (idempotent grants) but would send `sendEachForMulticast` twice for any
  user the second run still considers "newly granted" in a genuine race —
  acceptable for a rare recovery path.
