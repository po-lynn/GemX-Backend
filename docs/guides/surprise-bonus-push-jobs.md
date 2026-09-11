# Surprise Bonus: crediting and push notifications as separate queue jobs

## Prerequisites

Nothing extra — this builds on the existing `lib/queue` module and the
`background_jobs` table. No new env vars, no new dependencies, no migration
(the two job types are just distinct string values in the existing `type`
column). `FIREBASE_*` env vars are still required for push to actually send;
without them, push jobs will fail (visibly, on `/admin/queue`, see below)
instead of silently no-opping.

## How it works end-to-end

1. Admin clicks **Top-up → All Users** → `POST /api/admin/points/surprise-bonus`
   (`enqueueSurpriseBonusForAllUsers` in `features/points/services/enqueue-surprise-bonus.ts`).
2. A `surprise_bonus_batch` job is enqueued and drained inline
   (`processSurpriseBonusJob`). For each batch of ≤100 users it calls the
   `grant_surprise_bonus_user` RPC (ledger + points + in-app notification,
   atomic), then — for that batch's newly-granted users only — enqueues one
   `surprise_bonus_push_batch` job carrying `{ campaignId, campaignName,
   pointsPerUser, userIds }`.
3. After the credit drain finishes, the same request drains
   `surprise_bonus_push_batch` (`processSurpriseBonusPushJob`), which sends
   FCM to each job's `userIds` via `sendSurpriseBonusPushToUsers`.
4. Both job types are visible on `/admin/queue` under their own dropdown
   entry ("Surprise Bonus" / "Surprise Bonus Push") — each with its own
   pending/processing/completed/failed/stale counts, its own "Retry stuck
   jobs" action, and its own per-row delete button once a job reaches a
   terminal state.

Why two types instead of one: crediting money and delivering a push
notification have very different failure modes (a stuck DB lock vs. FCM
being down or misconfigured). Splitting them means a push failure never
blocks, retries, or double-counts a credit batch, and an admin can spot and
clear a stuck push batch without touching anything that already granted
points.

## Identifying and clearing a stuck/failed job

On `/admin/queue`:
1. Select **Surprise Bonus** or **Surprise Bonus Push** from the type dropdown.
2. The stat chips flag `Stale` (locked >3 min with no progress) and `Failed`
   in red. The job list's **Job** column shows the campaign name (both
   types resolve this from `describeJobs`, so you don't need to decode a raw
   job id), and **Last error** shows why it failed.
3. Click the chevron next to a job's name to expand it — a completed job
   shows what it actually did: for "Surprise Bonus", `Batch Users`, `Newly
   Granted`, `Already Granted`, `Failed`, and whether a push job was
   enqueued; for "Surprise Bonus Push", `Recipients`, `Sent`, `Failed`, and
   `Invalid Tokens Removed`. A job that hasn't completed, or one from before
   this detail view existed, shows "No details recorded for this job."
   instead — that's expected, not a bug.
4. Click **Retry stuck jobs** to run one more drain pass for that type — this
   is safe to click repeatedly; each pass only claims due/stale jobs.
5. If a job is truly stuck (e.g. it will keep failing because FCM is
   misconfigured, or a campaign is abandoned) and you just want it off the
   list, use the row's delete button. This only removes the queue tracking
   row — it never touches the campaign, the ledger, or any `app_notification`
   rows already written; it is only enabled once the job is `completed` or
   `failed`.

## How to extend

**Add another notification channel (e.g. SMS) for the same campaign:**
follow the same pattern — a new job type + handler (e.g.
`surprise_bonus_sms_batch`), enqueued alongside the push job in
`processSurpriseBonusJob`, registered in `lib/queue/registrations.ts`, and
drained inline in `enqueueSurpriseBonusForAllUsers` right after the push
drain (wrapped in its own try/catch so it can't fail the response either).
See `docs/guides/queue-management.md` for the generic "add a job type" steps.

**Change what counts as a push failure:** the threshold lives in
`processSurpriseBonusPushJob` (`features/points/services/process-surprise-bonus-push-jobs.ts`) —
currently it only throws when `sent === 0 && failed > 0` (a total failure).
If you want partial failures to retry too, change that condition, but note
`sendSurpriseBonusPushToUsers` already removes invalid tokens as a side
effect, so a "partial failure" there is often just normal token churn.

## Common errors

| Symptom | Cause | Fix |
|---|---|---|
| "Surprise Bonus Push" jobs pile up as `failed` | `FIREBASE_*` env vars missing/misconfigured — `sendPushNotification` returns `sent: 0, failed: N` for every batch | Fix the Firebase env vars, then click "Retry stuck jobs" on the Surprise Bonus Push type |
| A campaign shows `completed` with correct `successCount`, but users never got a push | Push jobs are separate rows — check the "Surprise Bonus Push" type on `/admin/queue`, not "Surprise Bonus" | Retry or inspect the push type's `Last error` column |
| Deleting a push job didn't re-send it | Delete only removes the tracking row (by design, see the technical doc) | Deletion is for cleanup, not resend — if you need it re-sent, you'd need to re-enqueue manually; there's no UI action for that yet |
