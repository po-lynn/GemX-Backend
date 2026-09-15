# Queue Console — Collaborator Guide

Covers the `/admin/queue` UI itself (overview → per-queue detail → job
drawer). For registering a new job type / handler, see
[`docs/guides/queue-management.md`](queue-management.md) — nothing about
that workflow changed; a newly registered type just automatically gets a row
on the overview and its own `/admin/queue/[type]` page.

## Prerequisites

Nothing extra — no new env vars, no new dependencies. The three screens
reuse `lib/queue/queue.ts`'s existing `background_jobs` queries plus a few
new read-only aggregate queries (see
[`docs/technical/queue-console-redesign.md`](../technical/queue-console-redesign.md)).

## Using it end-to-end

1. **Overview (`/admin/queue`)** — one row per registered job type
   (`lib/queue/registrations.ts`), sorted worst-health-first. Click a row
   (or "Inspect queue" on the alert banner) to open that type's detail page.
   "Retry stuck jobs" here retries **every** queue that currently has a
   nonzero stale count, not just one — it loops `POST
   /api/admin/queue/retry` per affected type client-side.
2. **Detail (`/admin/queue/[type]`)** — a status strip and the Jobs table:
   status-chip filter, search box, and a date-range control (`?range=` via
   the API, default 7 days). Selecting rows via their checkboxes opens the
   bulk bar (Retry / Cancel / Export); selecting a row never opens the
   drawer (checkbox clicks `stopPropagation`). There's no separate
   Transactions tab here — real per-user credit history (e.g. surprise-bonus
   grants) lives in `point_transaction` and isn't surfaced on this screen;
   query it directly if you need it (see
   [`docs/technical/queue-console-redesign.md`](../technical/queue-console-redesign.md#transactions-tab-removed-from-ui)).
3. **Job drawer** — opened by clicking a row, its open icon, or "Open full
   job detail →" in the expanded row strip. It's addressed by `?job=<id>` in
   the URL, so it's shareable/bookmarkable from the detail page. For a
   cold/direct link, use `/admin/queue/jobs/[id]` instead (no queue-detail
   context needed) — same actions, same underlying components
   (`JobActionsBar` + `JobDetailBody`), just page chrome instead of an
   overlay.
4. **Completed jobs auto-clear.** A job's row is deleted the moment it
   reaches `completed` (handler success, or a manual **Mark done**) — it
   won't show up in the Jobs table or a completed-status filter afterward.
   `failed`/`cancelled` jobs are unaffected and still need the manual
   **Delete** action. This also means the overview's completed counts,
   failure-rate %, p95, and throughput chart are no longer trustworthy — see
   [`docs/technical/queue-job-lifecycle-actions.md`](../technical/queue-job-lifecycle-actions.md#known-limitation--dashboard-metrics-that-count-completed-jobs).

## Extending it

- **A new job type just works** — nothing to add here. It appears on the
  overview the moment its registration module is imported by
  `lib/queue/registrations.ts` (see the other guide).
- **Add a field to the job drawer/detail body:** edit
  `components/admin/queue/JobDetailBody.tsx` (shared by the drawer and the
  standalone page) — don't edit `JobDrawer.tsx` or `JobDetailView.tsx`
  directly for shared content, or the two will drift.
- **Add a job-level action** (beyond Retry / Cancel / Mark done / Copy
  payload / Delete): add it to `components/admin/queue/JobActionsBar.tsx`
  and wire its network call in `useJobActions.ts` — both the drawer and the
  standalone page pick it up automatically since they share the same hook
  and bar component.
- **Add an overview KPI card:** `getPlatformQueueSummary` in
  `lib/queue/queue.ts` is the platform-wide aggregate; add a field there
  (one more `count(*) filter (...)` in the existing raw query, or a new
  query if it needs its own shape) and render it in
  `components/admin/queue/QueueOverview.tsx`'s KPI row.
- **Change the design tokens** (colors, radii, spacing): everything lives in
  `components/admin/queue/tokens.ts` (`QC` object) — it's only imported by
  the Queue screens, so changing it can't affect the rest of the admin
  panel.

## Common errors

| Symptom | Cause | Fix |
|---|---|---|
| `/admin/queue/[type]` 404s | The `type` in the URL isn't a currently-registered job type | Check `lib/queue/registrations.ts` — a type that's been renamed or unregistered will 404 any old bookmarked links |
| The job drawer never opens on click | `?job=<id>` didn't make it into the URL | Check that the click target isn't inside a checkbox's `stopPropagation` wrapper, and that `useSearchParams()` is reading the App Router's real URL, not a stale one from a client-side navigation library mismatch |
| CSV export downloads an empty file | Nothing matched the current filter/search/range at export time | Export always reflects what's currently visible in the table, not the full unfiltered set — clear filters first if you want everything |
| Health pill says "Failing" but nothing looks broken | A job failed within the last 24h even if it's since been manually retried and completed — `failed24h` counts *completions in the failed state during the window*, it isn't cleared by a later success | Wait for the 24h window to roll past, or check the queue detail page's Failed filter to confirm whether it's stale data |
| Alert-thresholds panel has no way to change the numbers | By design — nothing persists a per-queue threshold today; the panel is a read-only reference to the real constants driving this dashboard's own coloring | To actually change a threshold, edit the constants in `lib/queue/queue.ts` (`STALE_AFTER_MS`, `FAILURE_RATE_SLO_PCT`, `PENDING_AGE_ALERT_MS`, `DEFAULT_MAX_ATTEMPTS`) |
