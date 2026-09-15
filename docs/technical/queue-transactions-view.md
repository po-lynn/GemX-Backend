# Queue "Transactions" view

> **UI note:** the tab this doc describes was removed from
> `/admin/queue/[type]` — see ["Transactions tab removed from
> UI"](queue-console-redesign.md#transactions-tab-removed-from-ui) for why
> and what stayed. The API route, `listTransactions` hook, and
> `listSurpriseBonusTransactions` this doc describes are all still in place
> and unchanged — only the UI consuming them is gone. The rest of this doc
> (data flow, schema, edge cases) still accurately describes that backend.

## What changed

`/admin/queue` gained a second, flatter view of a job type's work, alongside
the existing batch-level "Jobs" view. It was added because the previous view
only showed one row per 100-user batch (e.g. `NYC200`), which made it
impossible to tell which *individual* user credit was stuck without any
per-user breakdown.

Files touched:

- `lib/queue/types.ts` — new `QueueTransactionRow` type; new optional
  `listTransactions` hook on `QueueJobDefinition`.
- `features/points/db/surprise-bonus.ts` — new `listSurpriseBonusTransactions`,
  the Surprise Bonus implementation of that hook.
- `features/points/services/process-surprise-bonus-jobs.ts` — wires
  `listTransactions: listSurpriseBonusTransactions` into
  `registerQueueJob({ type: SURPRISE_BONUS_JOB_TYPE, ... })`.
- `app/api/admin/queue/transactions/route.ts` — new `GET` route serving the
  view's data.
- `components/admin/queue/QueueDashboard.tsx` — new "Jobs" / "Transactions"
  tab toggle and the `TransactionsView` table + state filter chips.

## Data flow

```
GET /api/admin/queue/transactions?type=surprise_bonus_batch
  → getQueueJobDefinition(type).listTransactions(limit)
      → listSurpriseBonusTransactions(limit)   [features/points/db/surprise-bonus.ts]
          ├─ query 1: point_transaction (+ join user)
          │    WHERE reference_type = 'surprise_bonus_campaign'
          │    → one row per already-credited user, state: "completed"
          ├─ query 2: background_jobs
          │    WHERE type IN (SURPRISE_BONUS_JOB_TYPE, SURPRISE_BONUS_PUSH_JOB_TYPE)
          │      AND status != 'completed'
          │    → one row per still-in-flight batch, state mirrors job.status
          └─ query 3 (only if query 2 found rows): surprise_bonus_campaign
               → enriches job rows with the campaign name for their description
      → merge both row sets, sort by createdAt desc, slice to `limit`
  ← { supported: true, transactions: QueueTransactionRow[] }
```

`QueueDashboard` only fetches this endpoint lazily, the first time the
"Transactions" tab is clicked (`useEffect` keyed on `[view, selectedType]`),
so the existing "Jobs" view's fetch sequence is unchanged.

## Why two data sources, and why "transaction" detail is asymmetric

`grant_surprise_bonus_user` (`scripts/surprise-bonus-rpcs.sql`) only ever
inserts a `point_transaction` row on a **successful** grant — a failed grant
(`user_not_found`, `campaign_not_found`) returns a reason but leaves no row
behind. That means:

- **Completed** credits are visible at full per-user granularity (real
  `point_transaction` rows).
- **Pending / processing / failed** work is only visible at the *batch*
  granularity that `background_jobs` already tracks — there is no per-user
  record for a credit that hasn't happened yet or that failed. A batch row's
  `detail` field carries the job's `lastError`, or (for a stuck `processing`
  batch older than `STALE_AFTER_MS`, the same 3-minute window
  `claim_background_job` uses to reclaim it) `"Stale — locked but not
  progressing"`, or an `attempts/maxAttempts` summary otherwise.

This is called out explicitly in the `listSurpriseBonusTransactions` doc
comment and in `docs/guides/queue-transactions.md` so it isn't mistaken for a
complete per-user failure log.

## Schema impact

None. No migration was needed — `point_transaction.reference_type =
'surprise_bonus_campaign'` / `reference_id = campaignId` already existed
(set by `grant_surprise_bonus_user`) and was simply queried for the first
time from the admin panel.

## Auth & permissions

Same gate as the rest of `/api/admin/queue/*`:
`requireAdminOrFeature(request, FEATURE_KEYS.QUEUE_MANAGEMENT)` — admin
session or the `QUEUE_MANAGEMENT` RBAC feature.

## Edge cases & known limitations

- A job type registered without a `listTransactions` hook returns
  `{ supported: false, transactions: [] }` (200, not an error) — the client
  renders "Per-transaction detail isn't available for this job type yet."
  instead of the table.
- Per-user **failures** are not representable today (see above) — only
  batch-level failure/staleness. Making individual failed grants visible
  would require changing `grant_surprise_bonus_user` to leave a `status:
  'failed'` row behind instead of returning without one, which is a
  behavioral change to the ledger, not attempted here.
- `listTransactions(limit)` caps at `MAX_LIMIT = 500` in the route (default
  `200`); very active campaigns will only show the newest N rows across both
  sources combined, with no pagination.
- The Push job type (`SURPRISE_BONUS_PUSH_JOB_TYPE`) has no `listTransactions`
  hook of its own — its in-flight batches still surface as rows when
  Surprise Bonus's hook queries `background_jobs`, but selecting "Surprise
  Bonus Push" from the job-type dropdown (if it's ever registered as its own
  entry) would show `supported: false`.
