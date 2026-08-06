# Guide: Reviews & Seller Reputation admin area (phase 1)

Background and full rule definitions: `docs/superpowers/specs/2026-08-04-reviews-admin-phase1-design.md`.
Internals/data flow: `docs/technical/reviews-admin-phase1.md`.

## Prerequisites

- No new env vars.
- Migration `drizzle/migrations/0071_married_maverick.sql` must be applied (creates
  `reputation_threshold`, `seller_reputation_action`, `seller_archive`). Per this project's
  convention, migrations are applied manually — don't run `db:generate`/`db:migrate` to
  "fix" a missing-table error, confirm the migration has actually been run first.
- Any internal (non-admin) staff who need to see the Reviews area must be granted
  `FEATURE_KEYS.REVIEWS` (`"reviews"`) via the existing permissions UI
  (`/admin/settings/permissions` or wherever internal-role feature grants are managed in
  this codebase). `role === "admin"` users always have access, no grant needed.

## Using it end-to-end

1. Log in as an admin (or an internal user granted the `reviews` feature key).
2. Open the sidebar — a new **Trust & Reputation** section appears (inserted right after
   Master Data), containing an expandable **Reviews** submenu that starts open. It has 6
   children: Overview, Reputation cases, Seller ratings, Archived sellers, Thresholds,
   Audit log. Only **Reputation cases** is fully built in phase 1 — the other five show a
   "Coming in a later phase" placeholder.
3. Click **Reputation cases**, or go directly to `/admin/reviews/cases`. This is the
   primary working surface: a table of sellers currently flagged by one or more review
   signals, built on `ListViewCard` (see `docs/ADMIN-LIST-VIEW.md`).
4. Use the tabs (All / Critical / Buyer reports / Closed) to filter. "Buyer reports" is
   always empty in phase 1 (see limitations below).
5. Click a row to open the detail drawer (`ReputationCaseDrawer`) — seller info, the
   specific "why flagged" signals, recent buyer reviews (read-only), and the decision
   actions:
   - **Archive** — requires a reason, confirmed via a modal. Hides the seller from this
     table going forward and writes `seller_archive` + a `seller_reputation_action(archived)`
     row. This is record-only in phase 1: it does not hide the seller's listings or block
     them anywhere in the storefront.
   - **Dismiss** — requires a reason. Closes just this signal for this seller
     (`seller_reputation_action(dismissed, triggerKey=<rule>)`) without archiving. If a new
     qualifying review/tag event lands after the dismissal, the case reopens automatically.
   - Secondary chips (Warn, Limit orders, Hide listings only, Request documents, Escalate)
     — each just records an audit row (`seller_reputation_action`); none currently has any
     functional effect on the seller's account.
6. Select multiple rows to bulk-archive or bulk-dismiss with one reason applied to every
   selected seller.

Server actions live in `features/reviews/actions/reputation-cases.ts`:
`archiveSellerAction`, `dismissCaseAction`, `recordSecondaryActionAction`,
`bulkArchiveSellersAction`, `bulkDismissCasesAction`. All take/return plain
`{ success: true } | { error: string }` and are called from `ReputationCasesTable.tsx`
via `FormData` (single-row) or plain args (bulk).

## How a case is computed

There is no persisted "open case" table — every case is computed live. The entry point is
`computeCaseSummaries()` in `features/reviews/db/reputation-cases.ts`:

1. Reads which rules are enabled (`getEnabledThresholdIds()` in `reputation-thresholds.ts`
   — a rule only counts as enabled if both its `enabled` and `dataAvailable` flags are
   true).
2. Runs one query per enabled rule against `seller_rating` (+ tag joins where relevant):
   `rating_below_archive`, `negative_streak`, `tag_concentration`, `positive_burst`.
   (`non_delivery_reports` and `auto_archive` are never evaluated — no data source exists
   for either.)
3. Merges matches per seller into one case, taking the worst-matching rule's severity.
4. Suppresses a signal if a `dismissed` action exists for that `(seller, rule)` pair with
   no qualifying review since; excludes any seller with a live (unrestored) `seller_archive`
   row entirely.

`getOpenReputationCases`, `getReputationCaseCounts`, and `getReputationBadgeCounts` (used by
the page, the tab counts, and the sidebar API route respectively) all call
`computeCaseSummaries()` — there's one source of truth, so these numbers can't desync.

## Extending it

**Add a 7th threshold rule:**

1. Add a new entry to `DEFAULT_THRESHOLDS` in `features/reviews/db/reputation-thresholds.ts`
   — pick a stable `id` (used as the DB primary key and as `triggerKey` on dismiss/audit
   rows), a `label`, a `logicDescription`, `sortOrder`, and `dataAvailable` (`false` if the
   data this rule needs doesn't exist yet — it'll still show in the Thresholds view later
   but stay force-disabled).
2. Add the new id to the `ThresholdId` union type in the same file.
3. Write a matcher function in `features/reviews/db/reputation-cases.ts` following the
   shape of `matchRatingBelowArchive` / `matchNegativeStreak` / etc. — returns
   `RuleMatch[]` (`{ sellerUserId, detail, maxReviewCreatedAt }`).
4. Register it in three places in the same file:
   - `RULE_MATCHERS` — `{ your_rule_id: matchYourRule }`
   - `RULE_SEVERITY` — `{ your_rule_id: "critical" | "high" | "medium" | "watch" }`
   - `RULE_LABELS` — `{ your_rule_id: "Human-readable label" }`
5. Also add the id to `THRESHOLD_IDS` in `features/reviews/schemas/reputation-actions.ts`
   (the Zod enum used to validate `dismissCaseAction`'s `triggerKey`), or dismissing a case
   flagged by the new rule will fail validation.
6. A migration is **not** needed for step 1 — `ensureThresholdsSeeded()` inserts any new
   `DEFAULT_THRESHOLDS` row on the next read (`onConflictDoNothing`), since the table's
   contents are seeded at read time, not via migration data.

**Add a new secondary action type:** extend the `reputationActionTypeEnum` in
`drizzle/schema/reputation-schema.ts` (this *does* need a migration, since it's a Postgres
enum), the `ReputationActionType` union in `reputation-actions.ts` and
`reputation-cases.ts` (both actions/ and db/ files), the `secondaryActionSchema` enum in
`reputation-actions.ts` (schemas), and add a chip/button in
`ReputationCasesTable.tsx`/`ReputationCaseDrawer.tsx`.

**Add a new endpoint:** follow the existing badge-counts route
(`app/api/admin/reviews/badge-counts/route.ts`) as the template — `requireAdminOrFeature`
from `lib/api-guard.ts`, `FEATURE_KEYS.REVIEWS`.

## Common errors

- **Queries throw referencing `reputation_threshold` / `seller_reputation_action` /
  `seller_archive` not existing**: migration `0071_married_maverick.sql` hasn't been
  applied yet in that environment. Confirm with your DB tooling before assuming it's a
  code bug.
- **A Zod validation error on archive/dismiss**: server actions return `{ error: string }`
  (never throw) — surfaced client-side via `toast.error(result.error)`. Common cause: an
  empty reason (`archiveSellerSchema`/`dismissCaseSchema` both require a non-empty
  `reason`), or a `triggerKey` that isn't one of the 6 known threshold ids.
- **"Unauthorized" from a server action / 401/403 from the badge-counts route**: the
  calling user is neither `role === "admin"` nor an `internal` user holding the `reviews`
  feature key. Grant it via the permissions UI, or confirm you're logged in as the right
  account.
- **Sidebar badge never shows a count**: the badge only renders once `openCases`/
  `archivedSellers` is greater than 0 (see `AdminSidebar.tsx`) — a "0" is invisible, not
  a bug. Also note `useReviewsBadgeCounts` fetches once on mount with no polling, so it
  won't update live if a case opens/closes in another tab.
- **A case you dismissed reopens on its own**: expected — dismissal only suppresses the
  signal until a new qualifying review/tag event occurs for that seller after the
  dismissal timestamp (see "How a case is computed" above).
