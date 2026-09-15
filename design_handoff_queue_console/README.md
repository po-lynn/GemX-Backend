# Handoff: Queue Console (Admin)

## Overview
A premium/enterprise redesign of the GemX admin `/admin/queue` page. It replaces the single flat
job table with a three-level operations console:

1. **Queue overview** — health of every feature that uses the background queue, sorted by risk.
2. **Queue detail** — one feature's jobs and the point transactions those jobs wrote.
3. **Job detail drawer** — lifecycle timeline, error trace, payload, and resulting transactions.

Audience is mixed: ops/support watching for stuck jobs, engineers debugging failures, and admins
doing spot checks. The design targets "spot a problem in 5 seconds, act on it in two clicks".

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes that show the
intended look, structure and behaviour. They are **not production code to copy**. The task is to
**recreate these designs inside the target codebase** (the existing Next.js/React admin panel seen
in the source screenshots) using its established component library, routing, data-fetching and
styling patterns. If no environment exists yet, pick the framework the rest of the product uses.

`GemX Queue Console.dc.html` is authored in a prototyping runtime: markup lives in an `<x-dc>`
template with inline styles, and a `class Component` holds state/derived values. Read it as
"markup + state model", not as a React component to port line by line.

## Fidelity
**High fidelity.** Colors, typography, spacing, radii, shadows, copy and all six data states are
final and should be reproduced faithfully. Icon glyphs are inline SVG placeholders — swap them for
the codebase's icon set (equivalent shapes, same 13–16px sizing and 1.7–2 stroke width).

---

## Screens / Views

### 1. App shell
**Purpose:** persistent navigation and environment context.

**Layout:** `display:flex; min-height:100vh`, canvas `#F4F3EF`.
- **Sidebar rail:** `width:246px; flex:none; background:#14110C; color:#fff; position:sticky; top:0; height:100vh`, column flex.
  - Brand block: `padding:20px 18px 16px`, bottom border `1px solid rgba(255,255,255,.09)`. 28×28 mark, `border-radius:8px`, `background:#8F6A1C`, glyph 14px/700 `#14110C`. Title "GemX" 15px/700, `letter-spacing:-0.01em`. Sub "Admin console" 9.5px, `letter-spacing:.14em`, uppercase, `rgba(255,255,255,.42)`. Env chip "Prod" 9px/700 uppercase `#E8D5A6`, border `1px solid rgba(232,213,166,.34)`, radius 5px, padding `3px 6px`.
  - Nav: scrollable, `padding:14px 10px 24px`, items `padding:9px 10px; border-radius:8px; font-size:13.5px; color:rgba(255,255,255,.72); gap:10px`. Hover `background:rgba(255,255,255,.06); color:#fff`.
  - Group labels: 9.5px/700 uppercase, `letter-spacing:.14em`, `rgba(255,255,255,.3)`, `padding:16px 10px 7px`. Groups: Master data / Operations / Platform health.
  - Active item (Queue): `background:rgba(143,106,28,.22)`, `color:#fff`, weight 600, `box-shadow:inset 2px 0 0 #D8A93C`, icon stroke `#D8A93C`, trailing count badge — mono 10.5px/600, `background:#D8A93C`, `color:#14110C`, radius 5px, padding `2px 6px` (value = open problem count: stale or failed).
  - **Prototype state switcher** (footer, above the user block): remove in production. It only exists so reviewers can flip the six mocked states.
  - User block: `padding:12px 14px`, top border `rgba(255,255,255,.09)`; 26px avatar radius 7px `rgba(255,255,255,.1)`; name 12px/600; role 10px `rgba(255,255,255,.4)`; 7px green dot `#4FA97A`.
- **Top bar:** `height:60px; position:sticky; top:0; z-index:30; background:rgba(255,255,255,.86); backdrop-filter:blur(8px); border-bottom:1px solid #E3E0D8; padding:0 26px; gap:16px`.
  - Breadcrumb 12.5px `#9A958C`; "Queue" is a link (`#6B6760`, hover `#17130E`); current leaf `#17130E`/600 and only present on the detail screen.
  - Search: 290px, `background:#F4F3EF; border:1px solid #E3E0D8; radius:9px; padding:7px 11px`, placeholder 12.5px `#9A958C`, ⌘K hint mono 10px in a white 4px-radius chip. **Wire to the real search/command palette.**
  - Worker indicator: 11.5px `#6B6760`, 7px dot `#1C7A4F`, text "Workers 4/4".
- **Content column:** `padding:26px 26px 90px; max-width:1520px; margin:0 auto`.

### 2. Queue overview
**Purpose:** find the one queue that needs attention.

- **Page head:** eyebrow "Platform health" 10px/700 uppercase `letter-spacing:.15em` `#8F6A1C`; H1 30px/700 `letter-spacing:-0.025em`; deck 13.5px `#6B6760`, `max-width:56ch`, `text-wrap:pretty`.
  Right cluster: "Checked HH:MM" chip (white, `1px solid #E3E0D8`, radius 9px, padding `9px 12px`, 11.5px `#6B6760`); secondary **Refresh** (white, `1px solid #D9D5CB`, 12.5px/600, hover `#FAF9F6`/border `#C4BFB2`); primary **Retry stuck jobs** (`background:#17130E`, `color:#fff`, radius 9px, padding `10px 15px`, icon stroke `#D8A93C`, `box-shadow:0 1px 2px rgba(23,19,14,.28)`, hover `#2B2620`).
- **Alert banner** (only when a queue is stale or failing): `background:#FDF6E8; border:1px solid #EBD9AE; border-left:3px solid #B98A16; radius:12px; padding:15px 17px; gap:14px`. Title 13.5px/700 `#5E4508`; body 12.5px `#7A5C10`, `line-height:1.55` — the body must say what retrying does ("Retrying releases the lock and re-enqueues the batch; no points are granted twice"). Actions: "Retry all" (white, border `#E0CB9C`) and "Inspect queue" (`#8F6A1C` fill, white text).
- **KPI row:** `grid-template-columns:repeat(auto-fit,minmax(215px,1fr)); gap:14px`. Card: white, `1px solid #E3E0D8`, radius 13px, padding `17px 18px`, `box-shadow:0 1px 2px rgba(23,19,14,.03)`, internal `gap:12px`. Label 11.5px/600 `#6B6760`; value 29px/700 `letter-spacing:-0.03em`, `font-variant-numeric:tabular-nums`.
  1. *Jobs processed · 24h* — value + delta chip (green) + area sparkline (stroke `#8F6A1C` 1.8px, fill `rgba(143,106,28,.08)`).
  2. *Failure rate* — value + "of 12,480" + 6px progress track `#EFEDE7` with `#1C7A4F` fill scaled against the 1% SLO.
  3. *p95 run time* — value + amber delta chip + 10-bar histogram (`#EFEDE7` → `#D9D5CB` → `#8F6A1C` for the two most recent buckets).
  4. *Oldest pending job* — value turns `#A8620A` when over the 15m threshold; caption names the blocking job.
- **Queues table:** white card, `1px solid #E3E0D8`, radius 14px, `overflow:hidden`.
  - Card header: `padding:16px 18px`, bottom border `#EFEDE7`; title 14.5px/700; count chip 11px on `#F4F3EF`; right note "Sorted by risk" 11.5px `#6B6760`.
  - **Horizontal scroller:** `<div style="overflow-x:auto"><div style="min-width:1010px">` wrapping header **and** rows so columns stay locked together in a narrow pane.
  - Grid (identical on header and rows): `minmax(200px,2fr) 108px 96px 92px 84px 120px 132px 34px`, `column-gap:14px`, `padding:0 18px`. **Do not add a `gap` shorthand after `column-gap`** — it resets it and desyncs the header.
  - Header row: `background:#FAF9F6`, cells `padding:9px 0`, 10px/700 uppercase `letter-spacing:.11em` `#9A958C`. Columns: Queue, Health, Depth (right), Failed 24h (right), p95 (right), Throughput (center), Last run (right), chevron.
  - Body row: `padding:14px 0` per cell, bottom border `1px solid #F3F1EB`, hover `#FAF9F6`, whole row clickable → queue detail.
    - Queue cell: 30px tile radius 8px `background:#F4F3EF`, `1px solid #EFEDE7`, initials 11px/700 `#8F6A1C`; name 13.5px/600 with ellipsis; handler in mono 10.5px `#9A958C`.
    - Health pill: `display:inline-flex; gap:6px; radius:99px; padding:3px 9px 3px 7px`, 11.5px/600, 6px leading dot in the ink color. Healthy green, Stale/at-risk amber, Failing red, Idle grey (tokens below).
    - Failed 24h: `#9A958C` when 0, `#A8281F` otherwise.
    - Throughput: 8-bar sparkline, 6px bars, `#E3E0D8` with the newest bar in the row's health ink.
  - Rows shipped in the mock: Surprise Bonus, Points Payout, Push Notifications, Listing Indexer, Payment Webhooks, Review Digest, Export Jobs.
- **Bottom pair:** `grid-template-columns:repeat(auto-fit,minmax(340px,1fr)); gap:14px`.
  - *Alert thresholds* — 4 rows (Pending age > 15m, Failure rate > 1.0%, Visibility timeout 10m, Max attempts 5). Label 12.5px/600 + 11px `#9A958C` helper; value in mono 12px/600 chip `#F4F3EF` border `#EFEDE7` radius 6px. "Edit" link 11.5px/600 `#8F6A1C`.
  - *On-call notes* — 26px initial tile, note body 12.5px `#3E3A33` `line-height:1.6`, byline 10.5px `#9A958C`; composer row is a `1px dashed #D9D5CB` radius 9px affordance, "Add a note for the next shift".

### 3. Queue detail
**Purpose:** work one queue — filter, inspect, retry, export.

- **Head:** back link "← All queues" 11.5px/600 `#6B6760`; H1 27px/700 `letter-spacing:-0.025em`; health pill; handler chip in mono 11px (white, border `#E3E0D8`); description 13px `#6B6760`, `max-width:60ch` — state the retry policy in plain words. Right: same Refresh + Retry stuck jobs pair.
- **Status strip:** one bordered card, `grid-template-columns:repeat(auto-fit,minmax(150px,1fr))`, cells `padding:15px 17px` with `border-right`/`border-bottom:1px solid #EFEDE7` so it wraps cleanly. Per cell: 6px dot + 11px/600 label, 24px/700 value (tabular), 10.5px `#9A958C` caption. Six cells: Pending, Processing, Stale, Completed, Failed, Cancelled. **A cell is tinted (`bg`/`labelInk`/`valueInk` in its status color) only when its count > 0**, otherwise it stays white with `#17130E` value. **Counts must be derived from the same query that feeds the table** — never from separate hardcoded numbers.
- **Toolbar:** `padding:12px 16px`, bottom border `#EFEDE7`, wraps.
  - Grain tabs "Jobs | Transactions": segmented control on `#F4F3EF`, `1px solid #EFEDE7`, radius 9px, 3px padding; active item white, radius 7px, `box-shadow:0 1px 2px rgba(23,19,14,.1)`, `color:#17130E`; inactive `#6B6760`.
  - Search field (min 210px), then status filter chips (All, Pending, Processing, Completed, Failed, Cancelled): 11.5px/600, radius 99px, padding `6px 11px`; active `#17130E` fill + white text, inactive white with `1px solid #E3E0D8` and `#3E3A33` text.
  - Right: "Last 7 days" date range and "Export CSV", both white 12px chips with `1px solid #E3E0D8`, radius 9px.
- **Jobs table:** scroller `overflow-x:auto` + inner `min-width:1250px`; grid `38px minmax(220px,2.1fr) 118px 82px 140px 128px 128px minmax(150px,1.1fr) 66px` with `column-gap:14px` on header and rows.
  - Columns: checkbox, Job, Status, Attempts (right), Locked by, Created, Finished, Last error, Actions (right).
  - Checkbox: 15px, radius 4px, `1.5px solid #D9D5CB`; checked `#17130E` fill with a white 3.4-stroke tick. Header checkbox selects/clears the visible page.
  - Job cell: 18px caret button (hover `background:#EFEDE7`, rotates 90° when expanded) + name 13.5px/600 + job id in mono 10.5px `#9A958C`.
  - Attempts: tabular; turns `#A8281F` at max attempts ("5 / 5").
  - Locked by: mono 11px `#6B6760`, e.g. `worker-02 · 42m`.
  - Last error: 11.5px, `#9A958C` when "—", else `#A8281F`, single-line ellipsis.
  - Actions: two 26px square icon buttons, radius 7px, `1px solid #E3E0D8`; open → hover border `#C4BFB2`; delete → hover border `#E6B7B2`, `color:#A8281F`.
  - Selected row: `background:#FBF7EC`.
  - **Expanded row** (`background:#FAF9F6`, `padding:14px 18px 16px 84px`, wrapping `gap:26px`): Batch users, Newly granted (green), Already granted, Failed, Push enqueued, Run time — each 10px/700 uppercase label `#9A958C` over a 13.5px/600 value; right-aligned "Open full job detail →" 12px/600 `#8F6A1C`.
  - Footer: "Showing N of M jobs" 12px `#6B6760` + pager (28px squares, active `#17130E`/white, others white with `1px solid #E3E0D8`).
- **Transactions table** (Transactions tab): scroller `min-width:1010px`, grid `minmax(210px,2.2fr) 128px 140px 140px 120px 100px`, `column-gap:14px`. Columns: Description (name 13px/600 + email mono 10.5px `#9A958C`), State pill, Created, Completed, Reference (mono 11px), Detail (right, 12.5px/700 `#1C7A4F` for a credit, `#9A958C` for none).
- **Bulk action bar** (fixed, appears when ≥1 row selected): `position:fixed; bottom:26px; left:50%; transform:translateX(-50%); z-index:60`; `background:#17130E; color:#fff; radius:13px; padding:11px 13px 11px 17px; box-shadow:0 14px 34px rgba(23,19,14,.34)`. Count in `#D8A93C`; actions Retry / Cancel / Export on `rgba(255,255,255,.1)` (hover `.18`), radius 9px; "Clear" text button `rgba(255,255,255,.62)`. Nothing else may be fixed in that band.
- **Empty state:** `padding:70px 24px`, centered; 52px tile radius 14px `#F4F3EF`/`1px solid #EFEDE7` with a muted bar-chart glyph; title 16px/700; body 13px `#6B6760` `max-width:44ch` explaining *why* it is empty; buttons "Clear filters" (white) and "Back to overview" (`#17130E`).
- **Loading state:** 6 skeleton rows, `padding:16px 18px`, bottom border `#F3F1EB`, bars `#EFEDE7`/`#F3F1EB` radius 99px at varied widths, `animation: shimmer 1.4s ease-in-out infinite` (`opacity .45 → .9 → .45`).

### 4. Job detail drawer
**Purpose:** everything about one job without losing the list.

- **Shell:** `position:fixed; inset:0; z-index:80; display:flex; justify-content:flex-end`. Scrim `rgba(23,19,14,.28)` (click closes). Panel `width:560px; max-width:92vw; height:100%`, white, `border-left:1px solid #E3E0D8`, `box-shadow:-18px 0 44px rgba(23,19,14,.16)`, `animation: slidein .18s ease-out` (`translateX(22px)` + fade).
- **Header:** `padding:18px 22px 15px`, bottom border `#EFEDE7`. Status pill + job id chip (mono 11px on `#F4F3EF`); H2 20px/700 `letter-spacing:-0.02em`; sub 12px `#6B6760` ("Surprise Bonus · attempt 1 / 5 · queued by scheduler"); 30px close button, radius 8px, `1px solid #E3E0D8`.
- **Action bar:** `padding:12px 22px`, bottom border `#EFEDE7`. Primary "Retry now" (`#17130E`), secondary "Cancel job" and "Copy payload" (white, `1px solid #D9D5CB`), right-aligned destructive "Dead letter" (`#A8281F` text, `1px solid #E6B7B2`, hover `#FBE9E7`).
- **Body:** `flex:1; overflow:auto; padding:20px 22px 34px; gap:22px` column.
  - *Meta grid* — 2×2, `gap:1px` over `background:#EFEDE7` with `1px solid #EFEDE7`, radius 11px, `overflow:hidden`, cells white `padding:12px 14px`: Created, Finished, Run time, Locked by (mono). **Must carry `flex:none`** — as a shrinkable flex item with `overflow:hidden` its automatic min-height resolves to 0 and it collapses to the 2px gap.
  - *Lifecycle* — vertical timeline: 10px dot (`border:2px solid #fff`, `box-shadow:0 0 0 2px <ring>`) over a 1.5px `#EFEDE7` connector; step label 12.5px/600, time in mono 10.5px `#9A958C`, detail 12px `#6B6760`. Steps: Enqueued (grey) → Locked by worker (blue) → Attempt failed / Batch resolved (red / green) → terminal step. **The terminal step must agree with the trace:** exhausted attempts → "Moved to dead letter · no further retries"; otherwise "Retry scheduled · backoff 4m" or "Completed".
  - *Error trace* (only when the job has an error) — header with a mono error-code chip (`#A8281F` on `#FBE9E7`, `1px solid #F0CFCB`) and a "Copy trace" link; body `background:#FDF7F6; border:1px solid #F0CFCB; radius:11px; padding:13px 15px`, mono 11.5px `line-height:1.75` `#7A241D`, `white-space:pre-wrap`.
  - *Payload* — `background:#14110C; radius:11px; padding:14px 16px`, mono 11.5px `line-height:1.8` `#D9D5CB`, `white-space:pre`, `overflow-x:auto`; "Copy JSON" link.
  - *Point transactions written* — count chip + "View all" link; bordered list (`1px solid #EFEDE7`, radius 11px) of name/email/ref/amount rows, amount 12px/700 `#1C7A4F`.

---

## Interactions & Behavior
- Overview queue row click → queue detail for that queue. Breadcrumb "Queue" and "← All queues" return.
- Row caret toggles the inline meta strip (one row expanded at a time in the mock; multi-expand is fine).
- Row click, the open icon, and "Open full job detail →" all open the drawer. Drawer closes on scrim click and the close button; **add Esc-to-close and focus trapping in production** (not modelled in the prototype).
- Checkbox clicks must `stopPropagation` so selecting never opens the drawer.
- Header checkbox toggles all visible rows; the bulk bar appears at ≥1 selection and "Clear" empties it.
- Status chips filter the table client-side in the mock; server-side filtering is expected in production, combined with search and date range.
- Refresh shows the skeleton state (~900ms in the mock) then re-renders. The user asked for **manual refresh only** — no polling, no auto-refresh timer. Keep "Checked HH:MM" accurate.
- "Retry stuck jobs" / "Retry all" / bulk Retry re-enqueue and are expected to be idempotent; surface a confirmation toast and the number of jobs re-enqueued. Destructive actions (Delete, Dead letter, Cancel) need a confirm step.
- Transitions: hover color/background changes only (no duration specified — use the codebase default, ≤150ms). Drawer slide 180ms ease-out. Skeleton shimmer 1.4s infinite.
- Responsive: the shell is fluid; all three tables scroll horizontally inside their card at narrow widths (header and body share one scroller). Cards reflow via `auto-fit minmax()`. Below ~900px the sidebar should collapse to icons or a drawer — **not modelled, design decision open**.

## State Management
Client state in the prototype:
- `screen`: `'overview' | 'queue'` — becomes real routes (`/admin/queue`, `/admin/queue/[feature]`).
- `tab`: `'jobs' | 'tx'` — grain selector; worth putting in the URL.
- `filter`: status chip, default `'All'`.
- `selected`: array of job ids for bulk actions.
- `expanded`: job id whose inline meta strip is open.
- `openJob`: job id backing the drawer (null = closed); belongs in the URL so a job link is shareable.
- `variant`: **prototype-only** state selector (healthy / stuck / failed / bulk / empty / loading). Drop it; real data drives these states.

Data the real page needs:
- **Queue list:** name, handler, health, depth (pending+processing), failed_24h, p95_runtime, throughput buckets (8), last_run_at.
- **Queue summary:** counts by status (pending, processing, stale, completed, failed, cancelled) for the active filter window — the strip and the table must come from one source.
- **Job list (paged):** id, name, status, attempts/max_attempts, locked_by, locked_at, created_at, finished_at, duration, last_error, plus the batch meta shown when expanded (batch_users, newly_granted, already_granted, failed, push_enqueued).
- **Job detail:** lifecycle events (label, timestamp, detail, kind), error code + trace, payload JSON, related point transactions.
- **Thresholds & notes:** pending-age, failure-rate, visibility-timeout, max-attempts; on-call notes with author + timestamp.
- Derive "Stale" from `locked_at` older than the visibility timeout rather than storing a separate status if the backend allows.

## Design Tokens
**Surfaces**
- Canvas `#F4F3EF` · Panel `#FFFFFF` · Subtle fill `#FAF9F6` · Row tint (selected) `#FBF7EC`
- Dark rail `#14110C` · Rail active `rgba(143,106,28,.22)` · Rail hover `rgba(255,255,255,.06)`

**Borders**
- Default `#E3E0D8` · Hairline `#EFEDE7` · Row divider `#F3F1EB` · Strong (button) `#D9D5CB` · Hover `#C4BFB2`

**Ink**
- Primary `#17130E` · Secondary `#3E3A33` · Muted `#6B6760` · Faint `#9A958C` · Disabled/lines `#C4BFB2`

**Brand / accent**
- Gold `#8F6A1C` · Gold hover `#6E4F12` · Gold on dark `#D8A93C` · Gold pale `#E8D5A6` · Gold tint `#FBF7EC`

**Status (bg / ink)**
- Green `#E7F3EC` / `#1C7A4F` · Amber `#FDF0DF` / `#A8620A` · Red `#FBE9E7` / `#A8281F` · Blue `#E8EEF8` / `#2B5CA8` · Grey `#F4F3EF` / `#6B6760`
- Banner: `#FDF6E8` bg, `#EBD9AE` border, `#B98A16` left rule, `#5E4508` title, `#7A5C10` body
- Trace: `#FDF7F6` bg, `#F0CFCB` border, `#7A241D` text · Danger border `#E6B7B2`

**Typography**
- UI: `'Schibsted Grotesk', system-ui, sans-serif` — 400/500/600/700
- Mono (ids, handlers, refs, payload, traces): `'IBM Plex Mono', monospace` — 400/500/600
- Scale: 30/700 `-0.025em` (overview H1) · 27/700 `-0.025em` (detail H1) · 20/700 `-0.02em` (drawer H2) · 29/700 `-0.03em` (KPI) · 24/700 `-0.025em` (stat) · 16/700 (empty title) · 14.5–14/700 (card titles) · 13.5/600 (row primary) · 13–12.5/400–600 (body, cells) · 11.5/600 (pills, chips) · 10.5–11/400 (mono meta) · 10/700 `.11em` uppercase (table headers) · 9.5/700 `.14em` uppercase (rail groups)
- All numeric columns and metrics: `font-variant-numeric: tabular-nums`

**Radii** 4 (checkbox) · 5 (badge) · 6 (mono chip) · 7 (icon button, chip) · 8 (nav item, tile) · 9 (button, field) · 11 (panel block) · 12–14 (card) · 99 (pill)

**Shadows**
- Card `0 1px 2px rgba(23,19,14,.03)` · Primary button `0 1px 2px rgba(23,19,14,.28)` · Segmented active `0 1px 2px rgba(23,19,14,.1)` · Bulk bar `0 14px 34px rgba(23,19,14,.34)` · Drawer `-18px 0 44px rgba(23,19,14,.16)`

**Spacing** 4 · 5 · 6 · 7 · 9 · 11 · 12 · 14 · 16 · 18 · 20 · 22 · 26 (page gutter) · 36 · 70 (empty state)

**Layout constants** Sidebar 246 · Top bar 60 · Content max 1520 · Drawer 560 (`max-width:92vw`) · Table scroller min-widths: queues 1010, jobs 1250, transactions 1010

## Assets
- Fonts: Schibsted Grotesk + IBM Plex Mono via Google Fonts (`display=swap`). Substitute the codebase's equivalents if it already ships a grotesque + mono pair.
- Icons: inline SVG placeholders (1.7–2 stroke, 13–16px). Replace with the project's icon library — no icon in this design is bespoke.
- Brand mark: rendered as a gold rounded square with the letter "G". `gemx-logo.png` / `gemx-mark.png` exist in the project if the real mark is wanted.
- No photography or illustration.

## Files
- `GemX Queue Console.dc.html` — the design (app shell, overview, queue detail, job drawer, all six states).
- `support.js` — runtime for the prototype format. Needed only to open the HTML locally; not part of the design.
- `source-screenshots/` — the current production page (Jobs and Transactions tabs) the redesign replaces.

## Open questions / not modelled
- Sidebar behaviour below ~900px (collapse to icons vs. drawer).
- Whether Jobs and Transactions should merge into one table with a grain selector. Recommendation on record: keep them separate (different grains — 1 job : N transactions) and reach transactions scoped to a job from the job's transaction count.
- Permissions: who may Retry / Cancel / Dead letter / Delete.
- Real pagination strategy (offset vs. cursor) and page size.
- Toast/confirmation patterns for destructive actions — use the codebase's existing ones.
