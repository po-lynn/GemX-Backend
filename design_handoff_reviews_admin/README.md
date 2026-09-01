# Handoff: GEMX Admin — Reviews & Seller Reputation

## Overview
An admin backend area for the GEMX gem marketplace that lets administrators oversee the buyer
review and seller rating system. GEMX does **not** moderate individual review threads: buyer
reviews publish immediately. The admin's job is oversight — watch seller reputation, work the
cases that review signals open, and **archive** sellers whose reputation falls below policy
(with restore + appeal handling).

Six views, all reached from a new collapsible **Reviews** main menu in the existing admin sidebar:

1. Overview — marketplace rating health
2. Reputation cases — flagged sellers + decision panel (the core working surface)
3. Seller ratings — every rated seller
4. Archived sellers — archived list with Restore
5. Case thresholds — conditions that open a case + read-only rating-tag mirror
6. Audit log — every admin action

## About the Design Files
The file in this bundle (`GEMX Reviews Admin.dc.html`) is a **design reference created in HTML** —
a working prototype showing intended layout, states and behavior. It is **not production code to
copy**. The task is to recreate these screens inside the GEMX admin codebase using its existing
framework, component library, routing, data layer and auth. Where this document and the existing
codebase disagree on a primitive (button, table, badge), **prefer the codebase primitive** and keep
its own tokens; the values below tell you the intent and the exact look of the prototype.

The prototype is a single self-contained HTML file: it opens in any browser, all state is local,
all data is hard-coded fixtures. There is no backend.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, table density, badge treatments and
interaction states. It was built to match a screenshot of the live GEMX admin panel
(Admin → Settings → Rating tags), so the shell — sidebar, top bar, breadcrumb/title/count-pill page
header, tab strip, Search/Filter/Group/Sort toolbar, ACTIVE filter-chip bar — should already map
onto existing components in the codebase. Reuse them rather than rebuilding.

## Global Shell

### App frame
- Root: `display: flex; height: 100vh; overflow: hidden; min-width: 1320px;` on background `#F7F7F9`.
- Desktop-only design. No responsive breakpoints were specified; below ~1320px the intent is
  horizontal scroll of the content area, not a reflow.

### Sidebar (264px, fixed, own scroll)
- `background #FFFFFF`, `border-right: 1px solid #EDEDF0`.
- Brand row: 34px circle, `border 1.5px solid #E9D8FD`, violet `◈` glyph; wordmark "GemX"
  20px/600, `letter-spacing -0.02em`; right-aligned `ADMIN` pill — 10px/600, `letter-spacing .06em`,
  color `#7C3AED`, background `#F3EBFF`, radius 6px, padding 4px 8px.
- Section headers: 10.5px/600, `letter-spacing .09em`, `#A1A1AA`, uppercase, padding 20px 12px 8px,
  trailing chevron `#C4C4CC`. Sections in order: (top-level Dashboard), MASTER DATA,
  TRUST & REPUTATION, REQUESTS, COMMUNICATION.
- Nav item: padding 10px 12px, radius 10px, 14.5px/500, `#3F3F46`; icon slot 18px wide in a
  per-item accent color; hover `background #F7F7F9`.
- Expandable parent (Configuration, Reviews): same row + trailing chevron (`⌃` open / `⌄` closed).
  Open parent: color `#6D28D9`, weight 600, background `#FAF7FF`.
- Submenu: `margin-left 22px; padding-left 12px; border-left: 1px solid #EDEDF0`; items padding
  9px 12px, radius 9px, 14px. Active item: color `#6D28D9`, weight 600, background `#F3EBFF`,
  icon `#7C3AED`. Inactive: `#52525B`, weight 500, icon `#A1A1AA`.
- Nav badges: 10.5px/600, radius 6px, padding 2px 6-7px. Red badge (`#DC2626` on `#FEE2E2`) for
  Reputation cases (38) and the Reviews parent; neutral (`#71717A` on `#F4F4F6`) elsewhere.
  **Only short numbers belong in a nav badge** — long strings break the row height.
- Messages badge is a solid count: white on `#DC2626`, radius 99px.

#### Menu structure to add
```
TRUST & REPUTATION
  Reviews  (expandable, badge 38)
    Overview
    Reputation cases   badge 38
    Seller ratings
    Archived sellers   badge 29
    Thresholds
    Audit log
```
Existing items shown for context (do not change them): Dashboard; MASTER DATA → Products,
Configuration → Category / Laboratory / Origin / **Seller Rating Tags** / Precaution Tags;
REQUESTS → Payment Transactions, Collector Requests; COMMUNICATION → Messages (3), Users.

Routes suggested: `/admin/reviews`, `/admin/reviews/cases`, `/admin/reviews/sellers`,
`/admin/reviews/archived`, `/admin/reviews/thresholds`, `/admin/reviews/audit`.

### Top bar (64px)
White, `border-bottom 1px solid #EDEDF0`, padding 0 26px. Left: "Admin Panel" 15px/600 with
"GemX Marketplace" 12px `#71717A` beneath. Right, in order: search field (300px, height 38px,
radius 10px, `border #EDEDF0`, background `#FBFBFC`, placeholder "Search sellers, buyers, reviews…",
`⌘K` hint 11px `#A1A1AA`, focus border `#C4B5FD`); bell button 36px with a red count badge
(16px circle, 2px white ring); avatar 30px circle `#F3EBFF`/`#7C3AED` + "Admin" 14px/500 + chevron.

### Page header (repeated on every view)
- Breadcrumb 13px `#A1A1AA`: `Admin › Reviews › {view}`, last crumb `#52525B`.
- Title 25px/600 `letter-spacing -0.02em` + count pill (12.5px/600, `#7C3AED` on `#F3EBFF`,
  radius 8px, padding 4px 10px).
- Subhead 14px `#71717A`, `max-width 720px`, `text-wrap: pretty`.
- Right: secondary "Export Excel" (height 40px, radius 10px, `border #EDEDF0`, white, 13.5px/500)
  and primary CTA (height 40px, radius 10px, `background #7C3AED`, white, 13.5px/600,
  hover `#6D28D9`).

Per-view header copy:

| View | Count pill | Subhead | Primary CTA |
|---|---|---|---|
| Overview | 142,806 reviews | Buyer reviews publish immediately. This is where the marketplace rating and seller reputation are monitored. | New threshold |
| Reputation cases | 38 open | Sellers flagged by review signals. Archive hides the seller from buyers; dismiss closes the case with a reason. | New case |
| Seller ratings | 4,182 sellers | Every rated seller with its rating, distribution and review volume. | Export view |
| Archived sellers | 29 archived | Hidden from buyers and delisted. Restoring republishes the profile with its rating history intact. | Archive seller |
| Case thresholds | 6 rules | What opens a reputation case, and how the seller rating tags feed those rules. | New threshold |
| Audit log | 1,204 entries | Every archive, restore, warning and threshold change, with the admin who made it. | Export log |

### Card & table conventions
- Card: white, `border 1px solid #EDEDF0`, radius 14px. Inner padding 18-22px.
- Card header: title 15.5px/600, sub 12.5px `#71717A`, divider `1px solid #F4F4F6`.
- Table head: 11px/600, `letter-spacing .06em`, `#A1A1AA`, left-aligned (ACTION column right).
  On dashboard cards the head row sits on `#FBFBFC`; on full-page tables it is white with a
  `#F4F4F6` bottom border.
- Row: `border-bottom 1px solid #F4F4F6`, hover `background #FBFBFC`, cell padding 12-13px
  (20-22px on the first/last cell for the card gutter).
- Avatar chip: 28-32px, radius 9-10px, initials 11-12px/600, tinted per severity.
- ID text: 11.5px `#A1A1AA` under the name.
- Status/severity badge: 11.5px/500, radius 7px, padding 4px 9px. Severity badges also carry a
  6px dot in the text color.
- Checkbox: 15px, `accent-color #7C3AED`.
- Pagination footer: `background #FBFBFC`, 12.5px `#71717A` label left, Previous/Next buttons right
  (height 30px, radius 8px, `border #EDEDF0`; Previous disabled-looking at `#A1A1AA`).

### Rating tag chip (uses the client's real tags)
Pill: `display:inline-flex; gap 5-6px; padding 3-4px 9-10px; border-radius 99px; border 1px solid;
font-size 11.5-12.5px; font-weight 500` with a small sentiment glyph (▲ positive / ▼ negative).
- Positive (Fast Communication, Best Seller): text `#15803D`, background `#F0FDF4`, border `#BBF7D0`.
- Negative (Bad Communication): text `#B91C1C`, background `#FEF2F2`, border `#FECACA`.
These three tags are the client's live set (Admin → Settings → Rating tags) and are used verbatim.
Tags are **managed** in Configuration → Seller Rating Tags; the Reviews area only reads them.

---

## Screens / Views

### 1. Overview
Purpose: is marketplace rating health improving, and who needs attention.

Layout, top to bottom:
1. **KPI row** — `grid-template-columns: repeat(4, 1fr); gap 16px`. Card: label 13px `#71717A`
   left, delta badge right (12px/600, radius 7px, padding 3px 8px); value 30px/600
   `letter-spacing -0.03em` with a 13px `#A1A1AA` unit; note 12.5px `#71717A`.
   - Marketplace rating — 4.32 / 5 — +0.08 (green) — "Across 4,182 rated sellers"
   - Buyer reviews — 18,240 / 30d — +12.4% (green) — "94% from verified orders"
   - Sellers flagged — 38 open cases — 12 late (amber) — "7 at critical severity"
   - Sellers archived — 29 / 30d — +9 (red) — "4 reversed on appeal"
   Delta palettes: green `#15803D` on `#F0FDF4`; amber `#A16207` on `#FEF9C3`;
   red `#B91C1C` on `#FEE2E2`.
2. **Two-column row** `1.55fr 1fr; gap 16px`:
   - *Buyer reviews received* — 30 stacked bars, `height 200px`, `gap 5px`, each bar a column with a
     negative segment on top (`#FCA5A5`, radius 3px 3px 0 0) and a positive segment below
     (`linear-gradient(180deg,#A78BFA,#7C3AED)`, radius 0 0 3px 3px); native `title` tooltip per day;
     axis row beneath with 5 date labels 11.5px `#A1A1AA` above a `#F4F4F6` divider. Legend chips
     top-right: 9px squares `#8B5CF6` (4–5★) and `#FCA5A5` (1–2★).
   - *Rating distribution* — 4.32 at 38px/600, amber star row, "142,806 reviews"; then 5 rows
     `{n} ★ [bar] {pct}`, bar track `#F4F4F6` height 7px radius 99px, fills 5★ `#7C3AED`,
     4★ `#A78BFA`, 3★ `#FCD34D`, 2★ `#FB923C`, 1★ `#DC2626`; percentages 58 / 24 / 9 / 4 / 5.
     Below a `#F4F4F6` divider: **RATING TAG USAGE** (12.5px/600 `#71717A`, "3 tags active" right) —
     one row per tag: tag chip, progress bar, count. Fast Communication 6,412 (78%, `#22C55E`);
     Best Seller 4,180 (52%, `#22C55E`); Bad Communication 1,921 (24%, `#DC2626`).
3. **Two-column row** `1.55fr 1fr; gap 16px`:
   - *Sellers at risk of archiving* — card table, header link "Open cases →" (13px/600 `#7C3AED`,
     underline on hover) navigating to Reputation cases. Columns: SELLER (avatar + name + id),
     RATING (amber ★ + value + "· n"), 30D CHANGE (colored), 1–2★ SHARE, TRIGGER (badge).
     Rows: Pyin Oo Lwin Stones SLR-51204 3.84 ·204 −0.51 23% "Below 3.8 threshold" (red);
     Bagan Stone Traders SLR-40218 4.71 ·342 −0.34 10% "Rating manipulation" (red);
     Shwe Gems House SLR-30887 4.58 ·812 −0.22 8% "Dispute spike" (orange);
     Mandalay Jade Co. SLR-11902 4.92 ·1,204 +0.11 3% "Positive review burst" (orange);
     Inle Fine Jewels SLR-22415 4.40 ·566 −0.09 8% "Bad Communication tags" (neutral).
   - *Case pipeline* — 4 labelled progress rows (label 13.5px `#52525B`, value 13px/500 in the bar
     color, track `#F4F4F6` 6px): Open cases 38 (38%, `#7C3AED`); Critical severity 7 (18%,
     `#DC2626`); Decision overdue 12 (32%, `#F59E0B`); Appeals pending 5 (13%, `#0EA5E9`).
   - *Recent admin actions* — feed rows: 7px dot + text 13.5px `#3F3F46` + meta 12px `#A1A1AA`,
     divider `#F4F4F6`; header link "Audit log →". Four entries (archive red, automatic case amber,
     dismissal green, restore violet).

### 2. Reputation cases  ← primary surface
Purpose: decide what happens to a flagged seller.

**Toolbar card** (white card, radius 14px, above the table):
- Tab strip, `gap 26px`, padding 0 20px, bottom border `#F4F4F6`. Tab: padding 15px 2px,
  `border-bottom 2px solid` (`#7C3AED` active / transparent), 14px, active `#7C3AED`/600,
  inactive `#71717A`/500, each with a count pill (11.5px/600; active `#7C3AED` on `#F3EBFF`,
  else `#71717A` on `#F4F4F6`). Tabs: All 38 · Critical 7 · Buyer reports 14 · Closed 64.
- Control row, padding 14px 20px, `gap 10px`: search field (300px, as in the top bar); 1px×24px
  `#EDEDF0` divider; ghost buttons Filter and Group (height 38px, radius 10px, 13.5px/500,
  hover `#F7F7F9`, trailing chevron); **primary** "Sort: Severity" (violet, `⇅` glyph);
  spacer; ghost Columns and Export.
- ACTIVE chip bar, padding 11px 20px, `background #FBFBFC`, top border `#F4F4F6`, bottom corners
  rounded: label "ACTIVE" 11px/600 `#A1A1AA`; chips (white, `border #EDEDF0`, radius 8px,
  padding 5px 11px, 12.5px) reading `Sort by **Severity · descending** ✕` and
  `Status is **Open** ✕`; right "Clear all" 12.5px/500 `#7C3AED`.

**Bulk bar** (only when ≥1 row selected; `animation slideUp .18s`): `background #2E1065`,
radius 12px, padding 11px 16px. Label "{n} case(s) selected" 13.5px/600 `#F5F3FF`;
right: "Archive selected" (`#DC2626`, white, radius 9px, height 32px), "Dismiss flags"
(`border #5B21B6`, `#EDE9FE`), "Clear" (text `#C4B5FD`).

**Table** (flex row with the detail panel: table `flex: 1`, panel `flex: 0 0 392px`, `gap 16px`).
Columns and widths: checkbox 44px · SELLER & WHY IT WAS FLAGGED (fluid) · RATING 130px ·
NEGATIVE MIX 124px · SEVERITY 128px · OPEN FOR 104px · ACTION 178px (right-aligned).
All cells `vertical-align: top`. Whole row is clickable (selects the case); the checkbox cell and
the ACTION cell stop propagation.
- SELLER cell: avatar 28px + name 14px/600 + tier badge (PREMIUM `#6D28D9` on `#F3EBFF`,
  STANDARD `#52525B` on `#F4F4F6`) + id 11.5px `#A1A1AA`; then summary 13.5px `#52525B`,
  `line-height 1.5`, `max-width 520px`, `text-wrap: pretty`; then rating-tag chips.
- RATING cell: value 14.5px/500 + amber ★ + signed change 12px/600 (green/red) and
  "{n} reviews" 12px `#A1A1AA`.
- NEGATIVE MIX cell: 5-segment stacked bar (8px, radius 99px, track `#F4F4F6`, colors as the
  distribution scale) + "{x}% at 1–2★" 12px `#B91C1C`.
- SEVERITY cell: dot badge + trigger text 12px `#71717A`.
- OPEN FOR cell: duration 13.5px (red `#B91C1C` when overdue) + SLA 12px `#A1A1AA`.
- ACTION cell: "Archive" (`#B91C1C` on `#FEE2E2`, hover white on `#DC2626`), "Dismiss"
  (`#3F3F46` on `#F4F4F6`, hover `#E4E4E7`), and a 30px `›` icon button (`border #EDEDF0`).
- Selected row background `#FAF7FF`.
- Footer: "Showing 1–{n} of {total} open cases".

**Detail panel** (`position: sticky; top: 0; max-height: calc(100vh - 128px)`, own scroll,
`animation slideUp .2s`). Sections separated by `1px solid #F4F4F6`:
1. Header — "Reputation case" 14.5px/600 + case id 11.5px `#A1A1AA`; 28px `✕` close.
2. Seller — 38px avatar (radius 11px) + name 14.5px/600 + meta 12.5px `#71717A` + severity badge;
   then rating 24px/600 with amber stars and "{n} reviews", beside a compact 5-row distribution.
3. **WHY THIS SELLER IS FLAGGED** — signal rows: radius 10px, padding 10px 11px, tinted background
   by weight (red `#FEF2F2`/`#B91C1C`, orange `#FFF7ED`/`#C2410C`, green `#F0FDF4`/`#15803D`),
   glyph `!` or `✓`, label 13px/500, detail 12.5px `#71717A`.
4. **RECENT BUYER REVIEWS** (with a "read only" hint) — bordered cards (radius 11px,
   `border #F4F4F6`): amber stars + buyer name 12.5px/500 + relative time right; text 12.5px
   `#52525B`; then tag chips and order meta 11.5px `#A1A1AA`. Reviews are never editable here.
5. **SELLER RECORD** — 2-column key/value grid: Active listings, GMV (30d), Open escrow disputes,
   Prior warnings.
6. **DECISION** — red warning box (`background #FEF2F2`, `border #FECACA`, radius 10px):
   "Archiving hides the seller's profile and all {n} listings from buyers. Reviews stay attached to
   the record."; reason textarea (64px, radius 10px, `background #FBFBFC`, focus border `#C4B5FD`,
   placeholder "Reason for the decision (stored in the audit log)…"); then two 38px buttons —
   **Archive seller** (`#DC2626`, white) and **Dismiss flag** (outline); then secondary chips:
   Warn seller · Limit new orders · Hide listings only · Request documents · Escalate.

Case fixtures (6): CSE-1182 Pyin Oo Lwin Stones (Critical, below 3.8, 6 days, overdue);
CSE-1179 Bagan Stone Traders (Critical, rating manipulation, 3 days); CSE-1176 Shwe Gems House
(High, dispute rate, 2 days); CSE-1171 Mandalay Jade Co. (High, suspicious positive burst, 18h);
CSE-1168 Inle Fine Jewels (Medium, negative tag concentration, 4 days); CSE-1164 Naypyidaw Gem
Trade (Watch, buyer reports, 9h). Full copy for each — summary, signals, three buyer reviews,
record values — is in the HTML file's `CASES` array; treat it as the content spec.

### 3. Seller ratings
KPI row of four plain cards (label 13px `#71717A`, value 26px/600, note 12.5px): Rated sellers
4,182 · Sellers below 4.0 148 · Below archive threshold 19 · Currently archived 29.
Then a full-width table card, header "Seller rating profiles" with two filter buttons
(Tier: all, Status: all). Columns: SELLER · RATING (value + ★ + change) · DISTRIBUTION (5-segment
bar, 156px) · REVIEWS · LISTINGS · GMV (30D) · STATUS. Status badges: Case open (amber),
Active (green), Archive pending (red), New seller / Watch (neutral). 8 fixture rows.

### 4. Archived sellers
Notice card first (white, `border #EDEDF0`, radius 12px, red `!`, 13.5px `#52525B`): "Archived
sellers are hidden from search, their listings are delisted and buyers can no longer start a chat.
Existing orders continue under escrow. Restoring re-publishes the profile with its rating history
intact."
Table columns: SELLER (muted avatar `#F4F4F6`/`#71717A`, name `#52525B`) · RATING AT ARCHIVE ·
REASON · ARCHIVED (date) · BY · APPEAL (None neutral / Under review amber / Rejected red /
Upheld · restored green) · ACTION → **Restore** (`#6D28D9` on `#F3EBFF`, hover white on `#7C3AED`)
and "Record" outline. 6 fixture rows.

### 5. Case thresholds
`grid-template-columns: 1.5fr 1fr; gap 16px`.
- Left card "Case thresholds" / "When a seller crosses a threshold a case opens for an admin —
  nothing is archived automatically". Rows: order number 12px `#A1A1AA` (20px wide) · name
  14px/600 + logic 13px `#71717A` · hits 14px/500 with "cases / 30d" 11.5px `#A1A1AA` ·
  toggle (36×21px, radius 99px, knob 17px white; on `#7C3AED`, off `#D4D4D8`).
  1. Rating below archive threshold — rating < 3.80 with ≥30 reviews for 14 days → critical case — 19 — on
  2. Negative review streak — 7 of the last 10 buyer reviews are 1–2★ → case — 34 — on
  3. Bad Communication concentration — tag on >25% of reviews in 30 days → case — 22 — on
  4. Non-delivery reports — ≥3 buyers report no shipment after escrow funding in 30 days → critical case — 11 — on
  5. Suspicious positive burst — >20 reviews in 24h at 3× baseline or one device cluster → freeze rating + case — 9 — on
  6. Auto-archive on threshold breach — archive without an admin decision when rating < 3.50 for 30 days — 0 — **off**
- Right column: *Seller rating tags* card — read-only mirror of the three live tags with
  "Managed in Configuration → Seller Rating Tags", "3 total", per row a tag chip + sentiment badge
  + usage count, and the note "Tag counts feed the negative-tag threshold. Hidden tags stay in the
  system but are not offered to buyers." **Do not build tag CRUD here** — it already exists.
  Below it, *Case outcomes* dark card: `background #2E1065`, radius 14px; title `#F5F3FF`,
  sub `#C4B5FD`; 31% at 34px/600 `#C4B5FD`; a 3-segment bar on track `#4C1D95`
  (31% `#F87171` archived, 22% `#FBBF24` warned, 47% `#A78BFA` dismissed) with a legend and the
  line "4 of 29 archives were reversed on appeal in the last 90 days."

### 6. Audit log
Single table card, header "Review & reputation actions" + filters (Actor: all, Export Excel).
Columns: TIMESTAMP 176px · ACTOR 176px (24px avatar + name) · ACTION 160px (badge) · TARGET ·
REASON. Action badge palette: destructive red (Archived seller, Appeal rejected), amber
(Case opened, Warned seller), green (Flag dismissed), violet (Restored seller), blue
(Rating frozen, Limited orders), neutral (Threshold edited). 10 fixture rows; timestamps read
"04 Aug 2026 · 10:41".

---

## Interactions & Behavior
- **Sidebar**: Reviews and Configuration parents toggle their submenu (chevron flips `⌄`/`⌃`).
  Reviews starts open, Configuration closed. Submenu click switches view; active item is highlighted.
- **View switching** is client-side in the prototype; in the app use routes (see above).
- **Case row click** selects the case and fills the detail panel; the panel's `✕` deselects and the
  table expands to full width. Row-level Archive/Dismiss and the panel's buttons perform the same
  action.
- **Archive / Dismiss** (single or bulk) removes the case from the open list, clears the selection if
  it was the selected case, and shows a toast. Counts that must decrement together: sidebar badge,
  header count pill, "Sellers flagged" KPI, Open cases pipeline row, tab count, pager total.
  In production both actions must require a reason and write an audit entry; Archive should be
  confirmed (the red warning box is the in-panel warning, but a modal confirm is appropriate).
- **Restore** (Archived sellers) republishes the seller and shows a toast; in production it also
  writes an audit entry and clears the archive reason.
- **Bulk selection**: header checkbox selects/clears all visible rows; the bulk bar appears when at
  least one row is selected and animates in. Bulk archive in production must still capture a reason
  per seller — the prototype's toast says so explicitly.
- **Toast**: fixed, bottom center, `background #2E1065`, `color #F5F3FF`, radius 11px,
  padding 12px 17px, shadow `0 14px 34px rgba(46,16,101,.24)`, `✓` in `#C4B5FD`,
  `animation slideUp .2s`, auto-dismiss after 2.8s, `z-index 40`.
- **Tabs, Filter, Group, Sort, Columns, Export, pagination and the search fields are visual only**
  in the prototype. Wire them to real query state: tab → status facet, Sort → severity/date,
  Filter/Group → the ACTIVE chip bar (each chip removable, "Clear all" resets), Export → the
  existing Excel export.
- Animations: view enter `fadeIn .25s ease` (opacity 0→1); bulk bar and panel
  `slideUp` (`translateY(14px)` + opacity 0 → 0/1) at .18s / .2s.
- Hover states are defined per component above; every interactive element has one.
- No loading, empty or error states were designed. Needed before shipping: table skeletons,
  an empty "no open cases" state, and inline failure handling on archive/restore.

## State Management
Prototype state (single component):
- `view`: which of the six screens is showing.
- `reviewsOpen`, `configOpen`: sidebar submenu expansion.
- `selectedId`: selected case id, or null (drives the detail panel).
- `checked`: map of case id → bool for bulk selection.
- `tab`: active tab label on Reputation cases.
- `closed`: map of case id → bool, standing in for "case resolved"; drives every derived count.
- `toast`: message string, cleared by a 2.8s timer.

Production data needs, per view:
- Overview: marketplace rating + 30-day deltas, daily positive/negative review counts (30 points),
  rating distribution, per-tag usage counts, at-risk seller list, case pipeline counts, recent
  audit entries.
- Reputation cases: paginated cases with seller summary, rating + distribution, triggered signals,
  last N buyer reviews (read-only), seller record aggregates (listings, GMV, disputes, warnings),
  SLA clock; mutations archive / dismiss / warn / limit / restore, each with a reason.
- Seller ratings: paginated sellers with rating, distribution, review count, listings, GMV, status.
- Archived: archived sellers with reason, actor, date, appeal state.
- Thresholds: rule list with enabled flag and 30-day hit counts; read-only rating tags.
- Audit: paginated, filterable action log.

## Design Tokens
Colors — surfaces & lines
- App background `#F7F7F9`; card/sidebar/topbar `#FFFFFF`; subtle fill `#FBFBFC`;
  hover fill `#F7F7F9`; muted fill `#F4F4F6`
- Border `#EDEDF0`; inner divider `#F4F4F6`; sidebar submenu rail `#EDEDF0`

Colors — text
- Primary `#18181B`; strong `#27272A`; body `#3F3F46`; secondary `#52525B`; muted `#71717A`;
  faint `#A1A1AA`; disabled/icon `#C4C4CC`

Colors — violet (brand/primary)
- `#7C3AED` primary, `#6D28D9` hover/active text, `#8B5CF6` chart, `#A78BFA` chart light,
  `#C4B5FD` on-dark text & focus ring, `#E9D8FD` hairline, `#F3EBFF` tint, `#FAF7FF` row tint,
  `#4C1D95` on-dark track, `#2E1065` dark surface

Colors — semantic
- Success `#15803D` / bg `#F0FDF4` / border `#BBF7D0` / bar `#22C55E`
- Warning `#A16207` / bg `#FEF9C3`; orange `#C2410C` / bg `#FFEDD5`, `#FFF7ED`;
  amber accent `#F59E0B`, `#FBBF24`, `#FCD34D`; orange bar `#FB923C`
- Danger `#B91C1C` text, `#DC2626` fill, `#991B1B` on-tint text, bg `#FEE2E2`/`#FEF2F2`,
  border `#FECACA`, light `#FCA5A5`, on-dark `#F87171`
- Info `#1D4ED8` / bg `#EFF6FF`; `#0EA5E9` pipeline bar
- Star `#F59E0B`; empty star `#E4E4E7`
- Sidebar icon accents: `#7C3AED`, `#6366F1`, `#10B981`, `#0EA5E9`, `#F59E0B`, `#EC4899`
- Rating scale (5→1): `#7C3AED`, `#A78BFA`, `#FCD34D`, `#FB923C`, `#DC2626`

Typography — **Outfit** (Google Fonts, weights 400/500/600), fallback `system-ui, sans-serif`,
`-webkit-font-smoothing: antialiased`. No separate mono face; numbers use Outfit.
- Page title 25px/600, `letter-spacing -0.02em`
- KPI value 30px/600 · big stat 38px/600 · dark-card stat 34px/600 · secondary stat 26px/600 ·
  panel stat 24px/600 — all `letter-spacing -0.03em`
- Card title 15.5px/600 · panel section title 14.5px/600 · row title 14px/600
- Nav 14.5px/500, submenu 14px, tab 14px
- Body 13.5px · table cell 13-13.5px · secondary 12.5px · meta 12px · fine 11.5px
- Table head 11px/600, `letter-spacing .06em`; sidebar section 10.5px/600, `letter-spacing .09em`;
  ADMIN pill 10px/600, `letter-spacing .06em`
- Line height 1.45-1.5 on multi-line copy; `text-wrap: pretty` on summaries and subheads

Spacing — 2 / 3 / 5 / 6 / 7 / 9 / 10 / 11 / 12 / 14 / 16 / 18 / 20 / 22 / 26 px.
Page padding 22px 26px 44px; card padding 18-22px; grid gap 16px; sidebar width 264px;
detail panel 392px; top bar 64px; page min-width 1320px.

Radius — 6px (small badge) · 7px (status badge) · 8px (chip, small button) · 9px (submenu item,
action button) · 10px (nav item, input, primary button, signal row) · 11px (toast, review card) ·
12px (bulk bar, notice) · 14px (card) · 99px (pill, progress) · 50% (avatar).

Shadow — one only: toast `0 14px 34px rgba(46, 16, 101, 0.24)`. Cards use borders, not shadows.

Control sizes — nav row 40px · icon button 36px · input/toolbar button 38px · header button 40px ·
table action button 30px · secondary chip 31px · bulk button 32px · toggle 36×21px · checkbox 15px.

## Assets
None. No images, no icon library — icons are unicode glyphs
(`◈ ▦ ◰ ⚙ ★ ⚑ ⌫ ⧉ ⌕ ⌂ ✉ ☺ ⤓ ⚟ ◫ ⇅ ▥ ⌄ ⌃ › ✕ ✓ ! ▲ ▼ ⊞ ⚗ ⊕ ⌗ ⛨ ＋`) chosen so the prototype
stays dependency-free. **Replace all of them with the codebase's real icon set** (the live admin
uses line icons); keep the per-item accent colors listed under Sidebar.
Font: Outfit via Google Fonts. Avatars are initials on tinted backgrounds, no images.
All seller names, buyer names, ids, ratings, MMK amounts and dates are fixtures — replace with
real data. Currency is Myanmar kyat, formatted "6,000,000 MMK" and abbreviated "412M MMK".

## Files
- `GEMX Reviews Admin.dc.html` — the complete prototype: all six views, the sidebar/top bar shell,
  fixtures (`CASES`, seller/archive/audit/threshold arrays, the three rating tags in `TAG`) and the
  interaction logic. Open it directly in a browser; every screen is reachable from the Reviews menu.
- `README.md` — this document.

## Open questions for the team
1. Confirmed thresholds: is 3.80 the real archive floor, and 3.50 for auto-archive (currently off)?
2. Do archived sellers get a notification and a formal appeal window? The design assumes appeals
   exist (Archived sellers shows appeal state) but the appeal intake screen is not designed.
3. Should archiving be reversible by the same admin, or require a second approver?
4. Are there admin roles with read-only access to this area?
