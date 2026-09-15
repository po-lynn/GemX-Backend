# Queue Console redesign

## What changed

`/admin/queue` was rebuilt from a single flat page (a job-type `<select>`
plus one Jobs/Transactions table) into a three-level console, following the
high-fidelity design in `design_handoff_queue_console/GemX Queue Console.dc.html`:

1. **`/admin/queue`** — overview: per-queue-type health/depth/failure/p95/
   throughput, a platform-wide KPI row, an alert banner for the worst queue,
   and a read-only alert-thresholds reference panel.
2. **`/admin/queue/[type]`** — one queue type's detail: a status strip, the
   Jobs table (a Transactions tab existed briefly here — removed, see
   "Transactions tab removed from UI" below), search, status-chip and
   date-range filters, bulk select/retry/cancel/export, and CSV export.
3. **Job detail drawer** (`JobDrawer.tsx`) — a slide-over opened from the
   detail table (`?job=<id>` in the URL) with the lifecycle timeline, last
   error, and payload, without losing the list underneath. The old
   standalone job page still exists for shareable links, moved to
   **`/admin/queue/jobs/[id]`** (see [Routing](#routing) below).

The redesign is scoped to this feature's content only — the shared admin
shell (`AdminSidebar`, `AdminNavbarClient`, the purple `--admin-sidebar-*`
theme in `app/globals.css`) is untouched. The mock's own app shell (dark
sidebar, gold accent, `Schibsted Grotesk`/`IBM Plex Mono`) is a different
visual system than the rest of the admin panel and was not adopted globally;
only the Queue screens' *content* uses the new design tokens
(`components/admin/queue/tokens.ts`), scoped hover/keyframe CSS
(`app/admin-queue-console.css`), and the codebase's existing font stack
(`var(--font-sans)` / `var(--font-mono)` substitute for the mock's Google
Fonts, per the handoff's own "substitute the codebase's equivalents" note).

Files touched (representative, not exhaustive):

- `lib/queue/queue.ts` — new `getQueueTypeSummary`, `getPlatformQueueSummary`,
  `classifyQueueHealth`, plus exported threshold constants
  (`FAILURE_RATE_SLO_PCT`, `PENDING_AGE_ALERT_MS`, `DEFAULT_MAX_ATTEMPTS`).
  `listJobs` gained an optional `{ since }` filter for the date-range control.
- `lib/queue/types.ts` — new `QueueHealth`, `QueueTypeSummary`.
- `app/api/admin/queue/route.ts` — `GET` without `type` now returns
  per-type summaries + a platform rollup instead of bare counts; `GET` with
  `type` also returns that type's `summary` and accepts `range`.
- `app/api/admin/queue/[id]/route.ts` — new `GET` (single job, for the
  drawer) alongside the existing `DELETE`.
- `app/admin/queue/page.tsx` + `components/admin/queue/QueueOverview.tsx` —
  the new overview screen.
- `app/admin/queue/[type]/page.tsx` + `components/admin/queue/QueueDetail.tsx`
  — the new per-type detail screen (replaces `QueueDashboard.tsx`, deleted).
- `components/admin/queue/JobDrawer.tsx`, `JobActionsBar.tsx`,
  `JobDetailBody.tsx`, `job-types.ts`, `timeline.ts` — shared job-detail
  pieces, used by both the drawer and the standalone job page.
- `components/admin/queue/JobDetailView.tsx` — restyled to the new tokens,
  now composed from `JobActionsBar` + `JobDetailBody` instead of its own
  inline markup.
- `components/admin/queue/tokens.ts`, `primitives.tsx`, `format.ts` — design
  tokens, shared visual primitives (`Pill`, `Sparkline`, `AreaSparkline`,
  `Histogram`), and formatting helpers (`fmtDurationMs`, `fmtRelativeFrom`,
  `initials`, …) for the new screens.
- `app/admin-queue-console.css` — hover states and keyframes that can't be
  expressed as inline styles (everything else is inline, next to its tokens).

## Data flow

```
GET /admin/queue                             [Server Component, unchanged guard]
  → requireFeatureAccess(FEATURE_KEYS.QUEUE_MANAGEMENT)
  → renders <QueueOverview /> (client)
      → GET /api/admin/queue
          → getQueueTypeSummary(type, label) per registered type  [Promise.all]
          → getPlatformQueueSummary(types)
      → "Retry stuck jobs": loops POST /api/admin/queue/retry over
        every summary with counts.stale > 0 (client-side fan-out,
        no new bulk endpoint)

GET /admin/queue/[type]                      [Server Component]
  → requireFeatureAccess(...)
  → getQueueJobDefinition(type) — notFound() if unregistered
  → renders <QueueDetail type={type} /> (client)
      → GET /api/admin/queue?type=<type>&range=<range>
      → row click / open icon → sets ?job=<id> in the URL (shallow)
          → <JobDrawer jobId> → GET /api/admin/queue/<id>
      → bulk bar: loops POST .../requeue or .../cancel per selected id

/admin/queue/jobs/[id]                       [Server Component, unchanged pattern]
  → getJob(id) directly via Drizzle (no API round-trip for the initial read)
  → <JobDetailView job={...} />               [client — same actions as the drawer]
```

Bulk actions and "Retry stuck jobs" are client-side fan-outs over the
existing single-job/single-type endpoints (`Promise.all` of individual
`POST`s), not new batch API routes — there was no need for a new
transactional bulk endpoint at this volume, and it reuses every guard and
side effect the single-job routes already have.

## Schema impact

None. Every new metric is computed from `background_jobs` at read time:

- `getQueueTypeSummary` / `getPlatformQueueSummary` run one raw
  `db.execute(sql...)` aggregate query (percentile_cont for p95, `FILTER`
  clauses for the 24h/health counts) plus one `generate_series`-based query
  for the 8-hour throughput sparkline — see `lib/queue/queue.ts`. Nothing is
  cached or persisted; refreshing the page recomputes everything.
- `QueueHealth` (`"healthy" | "stale" | "failing" | "idle"`) is derived in
  `classifyQueueHealth`, never stored.

## Auth & permissions

Unchanged: `FEATURE_KEYS.QUEUE_MANAGEMENT` via `requireFeatureAccess`
(pages) / `requireAdminOrFeature` (API routes) — the same gate every
`/admin/queue*` route already used.

## Routing

`/admin/queue/[id]` (job-by-id) was moved to `/admin/queue/jobs/[id]`
because Next.js does not allow two different dynamic segment names
(`[id]` and `[type]`) as siblings under the same parent route — the new
`/admin/queue/[type]` (queue-by-type detail) needed that slot. `jobs` is a
plain static segment, so it coexists with `[type]` fine; the only
(unreachable in practice) edge case is a queue type literally named
`"jobs"`, which would need a nested segment to disambiguate — no such type
exists.

## Design decisions cut from the mock (no backing data, or out of scope)

The mock is a static prototype with fabricated data for scenarios GemX's
real schema doesn't currently support. Rather than fake these, they were
either adapted to real data or dropped:

- **On-call notes panel** — would need a new persisted feature (author,
  timestamp, per-shift notes). Out of scope for a queue-console redesign;
  not built as a stub either, per the "no half-finished implementations"
  guideline. Dropped entirely.
- **Editable alert thresholds** — the overview's "Alert thresholds" panel
  renders real constants (`STALE_AFTER_MS`, `FAILURE_RATE_SLO_PCT`,
  `PENDING_AGE_ALERT_MS`, `DEFAULT_MAX_ATTEMPTS`) as a read-only reference,
  not an editable form — nothing persists a per-queue threshold today.
- **"Dead letter" as a distinct drawer action** — a job that has exhausted
  its attempts is already terminal (`status: "failed"`); there's no
  separate dead-letter state in `background_jobs`. The drawer's destructive
  slot is **Delete** (the existing `deleteJob`, terminal-status-only)
  instead of inventing new backend state.
- **"Point transactions written" section in the job drawer** — nothing in
  the schema joins a `point_transaction` row back to the specific job id
  that wrote it (the type-level `listTransactions` hook returns rows *for a
  queue type*, not *for one job*). Omitted rather than approximated.
- **Server-side pagination on the jobs table** — `listJobs` already caps at
  100 rows; the detail table paginates that loaded set client-side (20/page)
  rather than building cursor-based server pagination for a cap that low.
- **Global `⌘K` search / command palette** — the mock's top-bar search is
  part of the (untouched) shared app shell, not this feature; left as a
  visual placeholder, matching the handoff's own "wire to the real
  search/command palette" note (i.e., a separate, cross-cutting piece of
  work).

## Transactions tab removed from UI

**What changed.** `QueueDetail.tsx`'s Jobs/Transactions tab switcher is
gone — the detail page now only shows the Jobs table. Removed: the `tab`
URL param, `loadTransactions`/its `useEffect`, `filteredTx`, the
`TransactionsTable` and `TabButton` components, and the tab-conditional
branches in `retryStuck`, `exportVisible`, and the job drawer's `onChanged`.
A stale `?tab=tx` bookmark from before this change is simply ignored — the
page renders the Jobs view regardless (see the regression test in
`tests/component/queue-detail.test.tsx`).

**Why.** Product decision, following on from [auto-delete on
completion](queue-job-lifecycle-actions.md#auto-delete-on-completion): once
jobs clean themselves up, the Jobs tab alone gives enough visibility for
queue operations, and the Transactions tab's real per-user
`point_transaction` rows (surprise-bonus credits — see
[queue-transactions-view.md](queue-transactions-view.md)) read as
redundant/cluttering alongside it in this view.

**What did *not* change.** `GET /api/admin/queue/transactions` (the route),
`listSurpriseBonusTransactions` (`features/points/db/surprise-bonus.ts`),
and the `listTransactions` hook on `QueueJobDefinition`
(`lib/queue/registry.ts`, `lib/queue/types.ts`) are all untouched and still
work if called directly — only the UI that surfaced them on `/admin/queue`
was removed. `point_transaction` itself was deliberately **not** touched:
deleting it on job completion would remove the unique-index-based
idempotency guard (`grant_surprise_bonus_user`'s `already_granted` check in
`scripts/surprise-bonus-rpcs.sql`) that prevents a reclaim race from
double-crediting a user — see the "Known limitation" note in
[queue-job-lifecycle-actions.md](queue-job-lifecycle-actions.md#known-limitation--dashboard-metrics-that-count-completed-jobs)
for the related, already-accepted trade-off on dashboard metrics.

**Where the data still lives.** A user's real surprise-bonus credit history
is `point_transaction` rows with `referenceType = "surprise_bonus_campaign"`
— permanent, queryable directly (e.g. via `listSurpriseBonusTransactions`
or a DB client), just no longer rendered on this admin screen.

## Edge cases & known limitations

- `getPlatformQueueSummary([])` (no registered queue types) returns
  all-zero defaults without querying — avoids an empty `type = any('{}')`
  query that would otherwise still hit the DB for nothing.
- The overview's "Retry stuck jobs" only targets queues whose `counts.stale
  > 0` at the moment of the click; a queue that goes stale mid-request is
  simply caught on the next click (manual refresh only — no polling, by
  design, same as the mock's interaction spec).
- CSV export (`exportCsv` in `QueueDetail.tsx`) is a client-side
  `Blob`/`<a download>` of whatever rows are currently loaded and filtered
  — it does not re-query the server for the full unfiltered set.
- The job drawer and `/admin/queue/jobs/[id]` intentionally duplicate their
  data fetch (drawer: client `GET`; page: server-side `getJob`) rather than
  sharing one cache, since they're reached through different paths (a
  same-page overlay vs. a cold, shareable link) and both need to work
  standalone.
