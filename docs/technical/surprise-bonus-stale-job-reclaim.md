# Fix: Surprise Bonus queue stuck at 0 processed on production

> **Update (later cleanup):** the `after()` drain and `/api/cron/process-surprise-bonus` mentioned throughout this doc have since been removed — Surprise Bonus is inline-only now (see [surprise-bonus-queue.md](./surprise-bonus-queue.md)). The reclaim fix described here (migration `0087`) is unaffected and is now the *only* recovery path: a stranded job is picked up by the next Top-up's inline drain, not by a cron tick.

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
a killed one is picked back up by the *next* Top-up submission's inline drain
instead of staying orphaned forever. `grant_surprise_bonus_user()` is already
idempotent per `(user_id, campaign_id)` via the unique index on
`point_transaction`, so the rare case of a reclaim racing a still-running
batch cannot double-credit a user — the loser's insert hits `already_granted`
and is skipped.

`app/api/admin/points/surprise-bonus/route.ts` also sets
`export const maxDuration = 60`, giving the inline drain more room to finish
before the platform kills the function, reducing how often a batch gets
killed in the first place.

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
Each Top-up submission's inline drain calls claim_background_job('surprise_bonus_batch', workerId)
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

Unchanged — admin create still requires `CREDIT_TRANSACTIONS`.

## Edge cases & known limitations

- A campaign interrupted mid-batch stays stranded until an admin submits
  **another** Top-up (any campaign) — there's no automatic background
  continuation. In practice this only matters for user bases large enough to
  exceed the 60s `maxDuration`.
- 3 minutes is a fixed threshold; a pathological single batch that legitimately
  takes longer (e.g. FCM provider degraded) could be double-claimed. This is
  safe (idempotent grants) but would send `sendEachForMulticast` twice for any
  user the second run still considers "newly granted" in a genuine race —
  acceptable for a rare recovery path.
