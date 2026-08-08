# Reviews & Seller Reputation admin area — Phase 2 (Overview, Seller ratings, Archived sellers, Thresholds, Audit log)

## Context

Phase 1 shipped the data model (`reputation_threshold`, `seller_reputation_action`,
`seller_archive`), RBAC (`FEATURE_KEYS.REVIEWS`), a live-computed case engine, and one fully
built view: **Reputation Cases** (`/admin/reviews/cases`). Five sibling routes exist today only
as `ComingSoonView` placeholders:

| Route | View |
|---|---|
| `/admin/reviews` | Overview |
| `/admin/reviews/sellers` | Seller ratings |
| `/admin/reviews/archived` | Archived sellers |
| `/admin/reviews/thresholds` | Thresholds |
| `/admin/reviews/audit` | Audit log |

Phase 2 builds all five. See
`docs/superpowers/specs/2026-08-04-reviews-admin-phase1-design.md` for the full phase-1
rationale (live-computed cases, why 3 tables, the design's non-goals) — this document only
covers what's new.

## Existing building blocks (do not duplicate)

- **Schema:** all three phase-1 tables, unchanged. No new tables in phase 2.
- **DB layer:** `getThresholds()` / `getEnabledThresholdIds()` (`reputation-thresholds.ts`),
  `getOpenReputationCases()` / `getReputationCaseCounts()` / `getReputationBadgeCounts()`
  (`reputation-cases.ts`), `archiveSeller()` / `dismissCase()` / `recordSecondaryAction()`
  (`reputation-actions.ts`).
- **RBAC:** `requireFeatureAccess(FEATURE_KEYS.REVIEWS)` (pages), `requireReviewsSession()`
  (server actions), `requireAdminOrFeature(request, FEATURE_KEYS.REVIEWS)` (API routes) — all
  three treat `role === "admin"` as an automatic pass, `role === "internal"` as gated on holding
  the feature key.
- **UI:** `ListViewCard` (`components/admin/list-view/`) — the generic table/filter/sort/
  pagination/drawer/bulk-action system every list view in this admin panel is built on.
  `ComingSoonView` (`features/reviews/components/`) — being replaced per-route, not reused.
  The `lv-*` CSS system (`app/admin-list-view.css`), including the `.lv-status.{severity}`
  variants phase 1 added.
- **Sidebar:** `AdminSidebar.tsx` already has all 6 Reviews children wired with the right hrefs
  and `featureKey` — phase 2 touches zero sidebar code.

## Explicit non-goals for phase 2 (confirmed with stakeholder)

- **No second-approver workflow.** Archive, restore, and threshold-toggle all remain
  single-admin actions, same as phase 1's archive/dismiss. Carried forward from phase 1's open
  items, still unresolved.
- **No read-only admin role.** RBAC stays binary (has the feature key, or doesn't).
- **No editing of a threshold rule's *logic*** (the 3.80/3.50 cutoffs, the 7-of-10 window, etc.)
  — only its `enabled` flag. Changing the underlying policy numbers is a code change, not a UI
  action, in phase 2.
- **No scheduler for `auto_archive`.** Toggling it on has no automatic runtime effect — no
  background job exists to act on it. The UI says so; it doesn't pretend otherwise.
- **No seller-level detail/drill-down page.** Seller ratings is a flat list. Clicking through to
  a seller's open case (if any) is out of scope — an admin who needs that already has Reputation
  Cases.
- **No new export/notification mechanisms.** `ListViewCard`'s existing generic Export button is
  inherited for free; no bespoke CSV or alerting work.

## New DB layer additions

No new tables. Five new/extended files, one function (or small function group) per view:

- `features/reviews/db/reputation-overview.ts` — `getReputationOverview()`
- `features/reviews/db/reputation-sellers.ts` — `getSellerRatings(opts)`
- `features/reviews/db/reputation-archive.ts` — `getArchivedSellers(opts)`, `restoreSeller(input)`
- `features/reviews/db/reputation-thresholds.ts` (extended) — `toggleThreshold(input)`
- `features/reviews/db/reputation-audit.ts` — `getAuditLog(opts)`

All queries are single aggregate/join statements against `seller_rating` / `seller_archive` /
`seller_reputation_action` / `user` — none call `computeCaseSummaries()`. Every DB call stays
sequential and `withQueryTimeout`-wrapped, matching phase 1's connection-pool constraint; no
`Promise.all` anywhere in this phase either.

## Overview (`/admin/reviews`)

Dashboard summary, not a table. `getReputationOverview()` gathers, sequentially:

1. `getReputationBadgeCounts()` (reused as-is from phase 1 — open cases, archived sellers).
2. Marketplace-wide average rating: `avg(score)` over all of `seller_rating`.
3. The 5 most recent `seller_reputation_action` rows, for a "recent activity" list.

Rendered as KPI tiles (open cases, archived sellers, marketplace avg rating) plus a short recent
-activity list below, using the same `lv-pagehead`/`lv-card` shell every other Reviews page
already uses. No filters, no pagination — this page is a glance, not a workspace.

## Seller ratings (`/admin/reviews/sellers`)

Full `ListViewCard` table, independent of the case engine. `getSellerRatings({ page, pageSize,
sort })` aggregates `seller_rating` grouped by `sellerUserId` — avg score, review count,
negative-mix % — joined to `user` for name/image. Every rated seller appears here, not just
flagged ones. No open-case cross-reference (see non-goals) — this view answers "how is this
seller rated," Reputation Cases answers "who needs my attention."

## Archived sellers (`/admin/reviews/archived`) + Restore

**List:** `getArchivedSellers({ page, pageSize })` — `seller_archive` rows where `restoredAt IS
NULL`, joined to `user`. Columns: seller, reason, archived-by (or "a since-deleted admin" if
that FK is now null — the exact case phase 1's whole-branch-review fix anticipated), archived-at,
appeal status.

**Restore mutation**, mirroring the Archive dialog's shape for consistency: requires a reason
(why restore — appeal upheld, mistake, etc.), writes `restoredAt = now()` +
`restoredByAdminId` to the row, and a `'restored'` `seller_reputation_action` audit row. New Zod
schema (`restoreSellerSchema`, reason `.min(1)`) alongside the existing ones in
`features/reviews/schemas/reputation-actions.ts`; new server action `restoreSellerAction`
following `archiveSellerAction`'s exact shape (validate → `requireReviewsSession` → mutate →
`{success}|{error}`). The `UPDATE` is guarded by `WHERE seller_user_id = ? AND restored_at IS
NULL` (not a blind update by seller id alone) — a concurrent double-restore then just affects 0
rows instead of overwriting `restoredByAdminId`/`restoredAt` a second time.

**Fix folded into this task:** `archiveSeller`'s `onConflictDoUpdate` (added in phase 1's
whole-branch-review fix wave) clears `restoredAt` but not `restoredByAdminId` on conflict — a
restore-then-rearchive would leave a contradictory row. This was parked in phase 1's ledger as
"unreachable until restore exists." Restore now exists; fix it as part of this task, not a
follow-up.

## Thresholds (`/admin/reviews/thresholds`) + Toggle

Reuses phase 1's `getThresholds()` unchanged (already returns all 6 rows ordered by
`sortOrder`). Renders each as a row: label, logic description, an `enabled` toggle.

The two off-by-default rules are off for different reasons, and the UI states which:
- `non_delivery_reports` (`dataAvailable: false`) — toggle **disabled**, "no data source exists
  yet" note. Flipping this would have zero effect and the UI shouldn't offer a false choice.
- `auto_archive` (`dataAvailable: true`, `enabled: false`) — toggle **stays live**; turning it on
  shows a note that no scheduler exists to act on it yet (matches the design spec's non-goal).

**Toggle mutation:** `toggleThreshold({ thresholdId, enabled, adminUserId, reason })` — updates
`reputation_threshold.enabled`, writes a `threshold_toggled` audit row (`sellerUserId: null`,
`triggerKey: thresholdId`, per the schema's existing accommodation for rule-level, not
seller-level, actions). Reason required, same convention as every other mutation in this
feature. **Validated server-side, not just hidden in the UI:** `toggleThreshold` rejects
`enabled: true` for any row where `dataAvailable` is `false` (currently only
`non_delivery_reports`) with an `{error}`, even though the UI never offers that toggle in the
first place — defense in depth against a direct action call bypassing the disabled control.

**Permission: admin-only, not the standard `requireReviewsSession` bar.** Archive/dismiss/
restore are scoped to one seller and reversible. A threshold toggle changes case detection for
the entire marketplace until someone notices and reverts it — no analogous per-item undo. The
page itself stays visible to any internal staff holding `FEATURE_KEYS.REVIEWS` (viewing is safe);
only the toggle action requires `role === "admin"`, reusing the admin bypass every existing guard
already special-cases rather than introducing a new permission tier.

## Audit log (`/admin/reviews/audit`)

`ListViewCard` table. `getAuditLog({ page, pageSize, filters })` — `seller_reputation_action`
reverse-chronological, joined to `user` for both `sellerUserId` and `adminUserId` (both handled
null-safely — the FK-cascade fix applies here directly) and `reputation_threshold` for
`triggerKey` when present. Filters: action type (`multi`, all 9 enum values) and date range
(`daterange`) — both `FilterDef` variants `ListViewCard` already supports natively.

Columns: timestamp, action type (styled pill, reusing the `.lv-status` CSS pattern from phase
1's severity column), seller (or "—" for rule-level actions like `threshold_toggled`), admin (or
"a since-deleted admin"), reason, trigger rule (if present).

## RBAC summary

| Surface | Gate | Notes |
|---|---|---|
| All 5 pages | `requireFeatureAccess(FEATURE_KEYS.REVIEWS)` | Unchanged from phase 1 |
| Restore action | `requireReviewsSession()` | Same bar as archive/dismiss |
| Toggle action | `requireReviewsSession()` **+** `role === "admin"` | New, higher bar — see Thresholds section |

## Testing

Same layering as phase 1: `tests/unit/` per new DB function (mocked `db`), `tests/api/` for the
two new/extended server actions (restore, toggle), `tests/component/` for each new table/list
component. Phase 1's whole-branch review found one bug (`ANY()` array binding) that survived
every mocked test and only surfaced under live-database verification — phase 2's plan includes
an explicit live-DB verification pass (seed real rows, click through each view in a browser) as
its own step, not left implicit.

## Open items carried forward (not phase-2 blockers)

- Second-approver / reversibility policy for archiving and restoring — still single-admin,
  unresolved from phase 1.
- Read-only admin roles — still not addressed.
- The 3.80 / 3.50 threshold policy values — still hardcoded defaults, not yet confirmed with the
  business stakeholder (phase 1's open item #1, still open).
