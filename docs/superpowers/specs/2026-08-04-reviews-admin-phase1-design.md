# Reviews & Seller Reputation — Admin Area (Phase 1: Data Model + Reputation Cases)

## Context

GEMX needs a new admin area for reviewing marketplace-wide seller reputation. Design
references live in `design_handoff_reviews_admin/` (`README.md` + `GEMX Reviews Admin.dc.html`,
a static fixture-only HTML prototype — not code to copy). The full feature is six views:
Overview, Reputation cases, Seller ratings, Archived sellers, Case thresholds, Audit log,
all under a new "Reviews" sidebar submenu inside a new "Trust & Reputation" section.

GEMX does not moderate individual reviews — buyer reviews publish immediately. The admin's
job is oversight: watch seller reputation, work cases that review signals open, and archive
sellers whose reputation falls below policy (with restore + appeal tracking).

This feature is large enough to split into phases. **Phase 1** covers the shared data model,
sidebar/routing scaffold, and the full build of **Reputation Cases** — the primary working
surface. The other five views get placeholder routes in phase 1 and are designed/built one
at a time in later phases.

## Existing building blocks (do not duplicate)

- `seller_rating` (`drizzle/schema/seller-rating-schema.ts`) — one row per (rater, seller)
  buyer review: `score`, `comment`. This *is* "buyer reviews" in the README's language.
- `rating_tag` / `rating_tag_map` — the three admin-managed tags (Fast Communication, Best
  Seller, Bad Communication) buyers attach to a rating. Managed at
  `/admin/settings/rating-tags`; Reviews only ever reads them, never edits (per README).
- `ListViewCard` (`components/admin/list-view/ListViewCard.tsx`, documented in
  `docs/ADMIN-LIST-VIEW.md`) — the existing table/toolbar/drawer/bulk-bar system used by
  Credit Purchase Requests and Premium Dealer Subscriptions. Reputation Cases reuses this
  rather than building a new table shell.
- `FEATURE_KEYS` / `FEATURE_GROUPS` (`features/rbac/feature-keys.ts`) + `AdminSidebar.tsx` —
  existing per-feature permission + sidebar pattern.
- Vercel Cron exists (`vercel.json`, `app/api/cron/*`) for other daily jobs, but phase 1 does
  **not** use it — case computation is live/on-demand (see below).

## Explicit non-goals for phase 1 (confirmed with stakeholder)

- No storefront enforcement of archiving (search hiding, listing delisting, chat blocking).
  Archiving only records state and surfaces it in the admin UI.
- No background scheduler / auto-archive execution, even though the "Auto-archive on
  threshold breach" rule exists as a toggle.
- No buyer-facing appeal intake flow — `appealStatus` is an admin-set field only.
- Rules 4 (non-delivery reports) and the device-cluster half of rule 5 are not computable —
  no buyer-report/dispute/device data exists anywhere in this schema.
- GMV and escrow-dispute figures are omitted everywhere (no order/escrow-deal table exists
  in this codebase at all — not even outside this feature).
- Secondary case actions (Warn seller, Limit new orders, Hide listings only, Request
  documents, Escalate) record intent (an audit row) only; none has functional effect yet.

## Schema (3 new tables)

### `reputation_threshold`
Persisted config for the 6 rules from the README, seeded via migration.

| column | type | notes |
|---|---|---|
| `id` | text PK | stable key, e.g. `rating_below_archive`, `negative_streak`, `tag_concentration`, `non_delivery_reports`, `positive_burst`, `auto_archive` |
| `label` | text | display name |
| `logicDescription` | text | the human-readable rule text shown in the UI |
| `enabled` | boolean | admin-toggleable |
| `sortOrder` | integer | matches README's numbered order |
| `dataAvailable` | boolean | false only for `non_delivery_reports`; drives disabled-toggle + inline note |

### `seller_reputation_action`
Append-only audit trail. This table **is** the Audit log view's data source, and also
suppresses a dismissed case from immediately reopening off stale data.

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `sellerUserId` | text, nullable, FK → `user` | null only for `threshold_toggled` |
| `actionType` | enum | `archived \| restored \| dismissed \| warned \| limited_orders \| listings_hidden \| documents_requested \| escalated \| threshold_toggled` |
| `triggerKey` | text, nullable, FK → `reputation_threshold.id` | which rule this action resolves (set for `dismissed`) |
| `reason` | text | required for archive/dismiss; optional for others |
| `adminUserId` | text, FK → `user` | |
| `createdAt` | timestamp | |

Indexes: `sellerUserId`, `(sellerUserId, triggerKey)`, `createdAt`.

### `seller_archive`
Current archive state — one row per seller that has ever been archived.

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `sellerUserId` | text, unique, FK → `user` | |
| `reason` | text | |
| `archivedByAdminId` | text, FK → `user` | |
| `archivedAt` | timestamp | |
| `appealStatus` | enum `none \| under_review \| rejected \| upheld_restored`, default `none` | admin-set only |
| `restoredAt` | timestamp, nullable | null = currently archived |
| `restoredByAdminId` | text, nullable, FK → `user` | |

## Case computation (live, no persisted "open case" rows)

Module: `features/reviews/db/reputation-cases.ts`. On each page load / query, compute open
cases directly from `seller_rating` (+ tag joins), per enabled rule:

1. **Rating below archive floor**: `avg(score) < 3.80 AND count(*) >= 30` per seller.
   *Simplification:* the README's "sustained 14 days" is not tracked as a rolling-window
   history (this schema has no such history table) — phase 1 flags on the current all-time
   average only.
2. **Negative review streak**: window function ranks each seller's last 10 reviews by
   `createdAt desc`; flag if `>= 7` have `score <= 2`.
3. **Bad Communication concentration**: reviews in the trailing 30 days tagged "Bad
   Communication" ÷ total reviews in that window `> 25%`, gated by a minimum 10-review
   sample (avoids noise on low-volume sellers).
4. **Positive burst (volume only)**: reviews in the last 24h `> 3x` the seller's trailing
   30-day daily average, gated by a minimum absolute count. Device-cluster detection is not
   implemented (no data).
5. Rules `non_delivery_reports` and `auto_archive` are never evaluated — inert placeholders.

Results per rule are merged into one case per seller (a seller may carry multiple signals;
severity is derived from the worst matching rule — mapping: rating-below-floor → critical,
negative-streak → high, tag-concentration → medium, positive-burst → high). Severity and
signal narratives are derived from real rule matches, not the prototype's fixture copy —
some fixture labels ("rating manipulation," "dispute spike") don't correspond to any of the
4 computable rules and will not reproduce from real data.

A case is suppressed (excluded from "open") if a `dismissed` action exists for that
`(sellerUserId, triggerKey)` pair with no qualifying review/tag event since. Archived
sellers (`seller_archive` row with `restoredAt IS NULL`) are excluded entirely.

## RBAC + routing

- New `FEATURE_KEYS.REVIEWS = "reviews"` — one shared permission key for all six views
  (matches "one cohesive workflow," not six independent tools).
- New "Trust & Reputation" `FEATURE_GROUPS` entry and new `AdminSidebar.tsx` section, with
  an expandable "Reviews" submenu (starts open, per README) and 6 children, using the
  sidebar's existing `renderSubMenu` pattern. Badge counts (open cases, archived count)
  computed live.
- Routes: `/admin/reviews` (Overview), `/admin/reviews/cases`, `/admin/reviews/sellers`,
  `/admin/reviews/archived`, `/admin/reviews/thresholds`, `/admin/reviews/audit`.
- Phase 1 fully builds `/admin/reviews/cases`. The other five get a minimal placeholder page
  (page header matching the shell conventions + "Coming in a later phase" card) so the
  sidebar has no dead links.

## Reputation Cases view

Built on `ListViewCard` (matches `docs/ADMIN-LIST-VIEW.md`'s existing pattern):

- `app/admin/reviews/cases/page.tsx` (server) — fetches computed open cases + tab counts
  (`All`, `Critical`, `Buyer reports` [always 0 — tied to the uncomputable non-delivery
  rule], `Closed` [resolved actions in the last 90 days]), passes to a client table.
- `features/reviews/components/ReputationCasesTable.tsx` (client) — column defs per the
  README's widths (Seller & why flagged / Rating / Negative mix / Severity / Open for /
  Action); `renderDrawer` renders the detail panel; `renderBulkActions` renders the bulk bar.
- Detail panel sections match the README (header, seller + rating, "why flagged" signals,
  recent buyer reviews [read-only], seller record, decision), with GMV/escrow-dispute rows
  omitted. "Prior warnings" = count of that seller's rows in `seller_reputation_action`;
  "Active listings" = a product count query (existing `product-schema`).
- **Archive**: requires a reason, confirmed via modal; writes `seller_archive` +
  `seller_reputation_action(archived)`.
- **Dismiss**: requires a reason; writes only `seller_reputation_action(dismissed,
  triggerKey=<matched rule>)`.
- Secondary chips (Warn, Limit orders, Hide listings only, Request documents, Escalate):
  each writes a `seller_reputation_action` row with the corresponding type; no functional
  enforcement (see non-goals).
- **Bulk archive / bulk dismiss**: one shared reason entered once in the bulk bar, applied
  to every selected seller's action row.
- Every count that must move together (sidebar badge, header count pill, tab counts, pager
  total) derives from the same live query — no separate counters to desync.

## Testing

- `tests/unit/` — one test per rule-computation function, with `seller_rating` fixtures
  crafted to hit/miss each threshold precisely (boundary cases: exactly 30 reviews, exactly
  3.80 average, exactly 7-of-10, etc.), plus suppression-logic tests (dismiss then a new
  qualifying review reopens; dismiss with no new review stays closed).
- `tests/api/` — archive/dismiss/restore mutations: permission checks (`FEATURE_KEYS.REVIEWS`),
  reason-required validation, correct audit rows written, bulk reason applied per seller.
- `tests/component/` — cases table + detail panel rendering, row/bulk actions, empty state
  ("no open cases").
- Required per this repo's CLAUDE.md: `docs/technical/`, `docs/guides/`, `docs/api/` outputs,
  and a live Chrome DevTools pass on the actual running page before calling phase 1 done.

## Open items carried forward (not phase-1 blockers)

- Confirm 3.80 / 3.50 as the real policy thresholds with the business stakeholder (README's
  open question #1) — phase 1 ships with these as configurable defaults.
- Second-approver / reversibility policy for archiving — phase 1 allows any admin with the
  Reviews permission to both archive and restore; no second approver required.
- Read-only admin roles — not addressed; existing RBAC permission model (view = has the
  key or not) applies as-is.
