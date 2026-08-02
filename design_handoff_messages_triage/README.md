# Handoff: GemX Admin — Messages (Communication)

## Overview

The GemX admin panel currently has two separate pages under **Communication**: *Messages* (a flat table of every message) and *Chat Dashboard* (a read-only conversation list). Admins had to move between them to do one job.

This design merges them into a single **Messages** page built as a three-pane triage inbox: a filter rail, a conversation/message list, and a reading pane with moderation actions. The admin can see every buyer↔seller chat, reply on escrow and Contact Us threads, and moderate policy violations without leaving the page.

**Recommendation:** retire *Chat Dashboard* from the sidebar, or keep it as a redirect to `Messages?mode=conversations`.

## About the Design Files

The files in this bundle are **design references created in HTML** — prototypes that show intended look and behavior. They are **not production code to copy**.

The task is to **recreate these designs in the GemX codebase's existing environment** (React, Vue, Blade, whatever the admin panel is built in), using its established component library, routing, and data layer. If no admin frontend environment exists yet, choose the framework that best fits the project and implement there.

The prototypes use a small custom runtime (`support.js`) purely so they render standalone in a browser. **Ignore that runtime entirely.** What matters is the markup structure, the exact visual values, and the described behavior.

## Fidelity

**High-fidelity.** Colors, typography, spacing, radii, and states are final and exact — the values in this README are authoritative. Recreate the UI pixel-accurately using the codebase's existing libraries. Where GemX already has a shared component (button, checkbox, avatar), use it and match these values via props/tokens rather than writing one-off CSS.

The sample content (Ni, Gemx4, Testing, Supervisor, emerald SKUs) is placeholder data drawn from the current production screens. Replace with live API data.

---

## Domain model

Three conversation **types**, which determine what an admin can do:

| Type | Value | Who is in it | Admin's job |
|---|---|---|---|
| Buyer ↔ Seller | `chat` | Two marketplace users only | **Observe and moderate.** GemX is not a participant. |
| Escrow | `escrow` | Buyer/seller + assigned GemX staff | **Reply.** An assigned user handles the escrow request. |
| Contact Us | `system` | User + GemX support | **Reply.** Support/system messages. |

Five workflow **statuses**, orthogonal to type:

| Status | Meaning |
|---|---|
| All statuses | No status filter applied |
| Flagged | Auto-flagged by a policy rule, or user-reported |
| Awaiting reply | Assigned to nobody, needs a GemX response (escrow + Contact Us only) |
| Assigned to me | Assigned to the current admin |
| Resolved | Reviewed and closed |

**Status and Type are two independent filters that AND together.** "All" in either rail means *do not filter on this axis*. Status=Flagged + Type=Escrow returns flagged escrow conversations. Both All returns everything. This is deliberate — an earlier draft duplicated Escrow into both rails, which was wrong: Escrow is a kind, not a state.

**Open question for the team:** *Awaiting reply* and *Assigned to me* are meaningless when Type = Buyer ↔ Seller (no GemX participant). Decide whether to disable/grey those two status options when that type is selected. Not implemented in the prototype.

---

## Screens / Views

The page is one route with two list **modes** toggled in the header. Layout, rails, and reading pane are identical in both modes — only the middle list's row content changes.

### Mode A — Conversations (default)
Middle list shows one row per thread. Replaces the old Chat Dashboard.

### Mode B — All messages
Middle list shows one row per individual message. Replaces the old Messages table. Selecting a message opens its parent thread in the reading pane, so context is never lost.

---

## Layout

Full-viewport app shell, `height: 100vh`, `overflow: hidden`.

```
┌─────────┬──────────────────────────────────────────────────────────┐
│         │  Top bar (68px)                                          │
│ Sidebar ├──────────────────────────────────────────────────────────┤
│ 264px   │  Page header — title, count, mode toggle, actions        │
│         ├────────┬──────────┬──────────────────────────────────────┤
│         │ Rails  │  List    │  Reading pane                        │
│         │ 212px  │  392px   │  flex:1, min-width 560px             │
└─────────┴────────┴──────────┴──────────────────────────────────────┘
```

- Outer wrapper: `width:100%; height:100vh; overflow-x:auto; overflow-y:hidden`
- Inner shell: `display:flex; height:100%; min-width:1500px; overflow:hidden`
- Below 1500px the whole shell scrolls horizontally rather than crushing the three panes. **This is the intended behavior** — this is a desktop-only admin tool. If GemX needs tablet support, the correct adaptation is to collapse the reading pane into a drawer, not to shrink the panes.
- Every pane scrolls independently. Each scroll container carries `min-height: 0` inside its flex parent.

### Column widths (fixed)
| Pane | Width |
|---|---|
| Sidebar | 264px, `flex: none` |
| Filter rails | 212px, `flex: none` |
| List | 392px, `flex: none` |
| Reading pane | `flex: 1`, `min-width: 560px` |

---

## Components

### 1. Sidebar (264px, `#fff`, right border `1px solid #ececf3`)

Matches the existing GemX admin sidebar exactly — reuse the production component. Notes:

- Brand row: 18px/20px/16px padding. Logo mark 34×34, `border-radius:11px`, `1px solid #e6e2f7`, glyph `#7c3aed` 15px. Wordmark "GemX" 19px/800/`-0.02em`. `ADMIN` pill: 10px/700, `letter-spacing:.08em`, `#7c3aed` on `#f1ecff`, padding 4px 9px, radius 7px.
- Section labels: 10.5px/700, `letter-spacing:.1em`, `#9a99a8`, padding `16px 12px 6px`.
- Nav item: `display:flex; gap:12px; padding:9px 12px; border-radius:10px`, 14px/600, `#4a4956`. Icon slot 18px wide, `opacity:.75`. Hover `background:#f7f6fb`.
- **Active item (Messages):** 14px/700, `#6d28d9` on `#f2edff`, padding `10px 12px`. Trailing count badge: 11px/700, `#6d28d9` on `#fff`, padding 2px 7px, radius 6px — shows the total flagged count across all types. This is the only unread-style indicator in the nav.
- Sections in order: Dashboard · MASTER DATA (Products, Configuration, Category, Laboratory, Origin) · REQUESTS (Payment Transactions, Collector Requests) · COMMUNICATION (Messages, Users) · CONTENT (News, Articles).

### 2. Top bar (68px, `#fff`, bottom border `1px solid #ececf3`, padding `0 24px`, gap 20px)

Existing component. Left: "Admin Panel" 15px/700 over "GemX Marketplace" 12px `#8b8a99`. Right: global search (280×38, `1px solid #e6e6ee`, radius 10, `#fbfbfd`), notification icon button (36×36, radius 10, hover `#f5f4f9`), avatar (32px circle, `#ede9fe` bg, `#6d28d9` initial 13px/700) + name 14px/600 + caret.

### 3. Page header (`#fff`, padding `18px 24px 14px`, bottom border `1px solid #ececf3`)

Row is `display:flex; flex-wrap:wrap; gap:16px; align-items:flex-start`. Left block `flex:1; min-width:280px`.

- **H1** "Messages" — 26px/800, `letter-spacing:-0.03em`, `#17161c`, margin 0.
- **Count pill** — 12px/700, `#6d28d9` on `#f1ecff`, padding 4px 10px, radius 8. Text: `"{n} conversations · {m} messages"` in Conversations mode, `"{m} messages"` in All messages mode.
- **Subtitle** — 13.5px `#6b6a78`, margin-top 6px: "Conversation oversight and message moderation in one place."
- **Mode toggle** — segmented control. Track: `display:flex; gap:2px; padding:3px; background:#f3f3f8; border-radius:10px`. Segment: height 32, padding `0 14px`, radius 8, 13px. Selected: 700, `#17161c`, `background:#fff`. Unselected: 600, `#8b8a99`, transparent. Labels `◫ Conversations` / `▤ All messages`.
- **Export** — height 38, padding `0 14px`, `#fff`, `1px solid #e3e3ec`, radius 10, 13.5px/600 `#3d3c49`, `white-space:nowrap`. Hover `border-color:#cfcfe0`.
- **New message** — height 38, padding `0 16px`, `#7c3aed`, no border, radius 10, 13.5px/700 `#fff`. Hover `#6d28d9`.

### 4. Filter rails (212px, `#fcfcfe`, right border `1px solid #ececf3`, padding `14px 10px`, `overflow-y:auto`)

Two groups, `STATUS` then `TYPE`, each headed by a 10.5px/700 `.1em` `#9a99a8` label (`padding:6px 10px`; the second gets `18px 10px 6px`).

Row: `display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:9px`, 13.5px. Idle 600 `#4a4956` transparent; hover `#f4f3f9`; **selected 700 `#6d28d9` on `#f2edff`**. Trailing count 11.5px/700 (`#6d28d9` selected, `#9a99a8` idle). STATUS rows have a 16px icon slot at `opacity:.8`; TYPE rows have no icon and use `padding:7px 10px`.

STATUS: All statuses `◎` · Flagged `⚑` · Awaiting reply `◔` · Assigned to me `◑` · Resolved `✓`
TYPE: All types · Buyer ↔ Seller · Escrow · Contact Us

Counts are live and reflect the *other* rail's active filter plus the current mode.

**SLA card**, pinned to the bottom (`margin-top:auto`): padding `11px 12px`, `1px dashed #ded9f5`, radius 11, `background:#faf8ff`. Label 11.5px/700 `.05em` `#5b21b6` "SLA"; body 12px `#6b6a78` line-height 1.45 — "4 flagged items breach in under 2h." Wire to real SLA data or drop it.

**Icons:** the prototype uses Unicode glyphs as stand-ins. Replace all of them with the codebase's real icon set at 16–18px, matching the stated colors.

### 5. List pane (392px, `#fff`, right border `1px solid #ececf3`)

**Header** (`flex:none`, padding `12px 14px`, bottom border `1px solid #f0f0f5`):
- Search: height 36, `1px solid #e6e6ee`, radius 9, `#fbfbfd`, padding `0 11px`, 13px. Leading `⌕`, trailing `/` key hint (11px, `1px solid #e6e6ee`, `#fff`, padding 1px 6px, radius 5). Placeholder differs by mode: "Search conversations, participants…" / "Search message text, SKU…". Filters across all row fields including SKU.
- Below, margin-top 10: result label 12px/700 `#3d3c49` — `"{Status} · {n} conversations|messages"` — and a right-aligned sort toggle 12px `#6b6a78`, "Newest ▾" / "Oldest ▾".

**Row** (`display:flex; gap:11px; padding:12px 14px`, bottom border `1px solid #f4f4f8`, `border-left:3px solid transparent`, cursor pointer):
- Avatar 32px circle, initial 12px/700 `#fff`, background from the participant color map.
- Title 13.5px/700 `-0.01em`, single line, ellipsis. Conversations: `"{A} ↔ {B}"`. All messages: `"{from} → {to}"`.
- Timestamp, right-aligned in the title row: 11.5px `#9a99a8`, `white-space:nowrap`.
- Preview 13px `#4a4956`, margin-top 3, single line, ellipsis.
- Meta row, margin-top 6, gap 6: optional tag chip + 11.5px `#9a99a8` message count (Conversations mode only).
- **Selected:** `background:#f7f4ff`, `border-left-color:#7c3aed`. **Hover:** `background:#fafaff`.

**Empty state:** padding `52px 24px`, centered. 14px/700 `#3d3c49` "No matches" + 13px `#8b8a99` "Try a different term or switch view."

### 6. Reading pane (`flex:1`, `min-width:560px`, `background:#fbfbfd`)

**Header** (`flex:none`, `#fff`, padding `14px 20px`, bottom border `1px solid #ececf3`, `flex-wrap:wrap`, gap 12):
- Overlapping avatar pair: both 34px circles, second `margin-left:-10px; border:2px solid #fff`.
- Title block `flex:1; min-width:0` — `"{A} ↔ {B}"` 15.5px/800 `-0.02em`, and meta 12.5px `#8b8a99` — `"{n} messages · {Type} · thread #{id}"`. **Both single-line with ellipsis** so the action buttons never get pushed off.
- Actions, all `white-space:nowrap`, height 34, radius 9:
  - `⚑ Flag` — `#fff`, `1px solid #e3e3ec`, 13px/600 `#3d3c49`, trailing key hint `F` in `#a8a7b5`. Hover `border-color:#cfcfe0`.
  - `Delete ⌫` — `#fff`, `1px solid #f3c9c9`, 13px/600 `#b91c1c`. Hover `background:#fff7f7`.
  - `✓ Resolve E` — `#7c3aed`, no border, 13px/700 `#fff`. Hover `#6d28d9`.
  - Overflow `⋯` — 34×34, radius 9, `#6b6a78`, hover `#f5f4f9`.

**Risk banner** — rendered only when the thread has a policy match. `flex:none`, margin `14px 20px 0`, `1px solid #fde4c8`, `background:#fffaf2`, radius 12, padding `11px 14px`, flex row gap 12. Label 11.5px/800 `.05em` `#b45309` — "POLICY P-114 · OFF-PLATFORM PAYMENT". Detail 12.5px `#6b5a45` — "Confidence 0.88 · sender has 3 prior strikes". Right link 12.5px/700 `#b45309` "Review policy →".

**Thread scroller** (`flex:1; min-height:0; overflow-y:auto`, padding `16px 20px`, column, gap 12):
- Date divider, self-centered: 11.5px `#9a99a8` on `#f1f1f6`, padding 4px 11px, radius 20.
- Bubble group, `max-width:64%`, aligned left (other party) or right (`mine` — the GemX-side or seller-side participant).
  - Author line above: 11.5px `#9a99a8`, margin-bottom 4, aligned with the bubble — `"{who} · {time}"`.
  - Bubble: padding `11px 14px`, radius 14, 13.5px, line-height 1.5.
    - Incoming: `#fff` on `1px solid #ececf3`, text `#2c2b36`.
    - Outgoing: `#7c3aed`, border same, text `#fff`.
    - **Flagged (either side): border `1px solid #f59e0b`**, plus a caption below — 11.5px/700 `#b45309` "⚑ flagged by system", aligned with the bubble.

**Internal note bar** (`flex:none`, `#fff`, padding `12px 20px`, top border `1px solid #ececf3`, flex row gap 10):
- Label 12px/700 `.05em` `#9a99a8` "INTERNAL".
- Input `flex:1`, height 38, `1px solid #e6e6ee`, radius 10, `#fbfbfd`, 13px — placeholder "Add a note — visible to admins only".
- Submit: height 38, padding `0 14px`, `#17161c`, radius 10, 13px/700 `#fff`, "Save ⌘⏎".

Notes are **admin-only** and never delivered to the marketplace users. On escrow and Contact Us threads, a separate *reply* composer will also be needed — see Not Yet Designed.

---

## Interactions & Behavior

| Trigger | Result |
|---|---|
| Mode toggle | Swaps list rows between conversations and messages. Resets selection to the first row. Should be reflected in the URL (`?mode=conversations\|messages`). |
| Status rail click | Sets status filter. Type filter and query persist. |
| Type rail click | Sets type filter. Status filter and query persist. |
| Search input | Live substring filter across sender, recipient, body, and SKU. Case-insensitive. Debounce ~150ms against a real API. |
| Sort toggle | Flips newest ↔ oldest on the sent timestamp. |
| Row click | Selects the row; reading pane loads that thread (in All-messages mode, the parent thread) and should scroll to the selected message. |
| Flag / Delete / Resolve | Not wired in the prototype. Each should optimistically update the row, write an audit entry, and toast. Delete requires confirmation. |
| `⋯` | Overflow menu — Assign to…, Export thread, View user profile, Open listing. Not designed. |

**Keyboard** (specified, not implemented — the hints are printed on the buttons):
`J`/`K` next/previous row · `Enter` open · `F` flag · `E` resolve · `⌫` delete (with confirm) · `⌘⏎` save note · `/` focus search · `Esc` clear search.

**Transitions:** background/border color changes only, 120ms ease. No layout animation, no slide-in. Selection feedback must feel instant.

**Loading:** skeleton rows in the list (avatar circle + two grey bars) and a centered spinner in the reading pane. Never blank the panes.

**Errors:** inline retry card in the affected pane; failed actions revert the optimistic update and toast the reason.

---

## State Management

```
mode:      'conversations' | 'messages'        // default 'conversations'
status:    'all' | 'flagged' | 'awaiting' | 'mine' | 'resolved'
type:      'all' | 'chat' | 'escrow' | 'system'
query:     string
sortDesc:  boolean                             // true = newest first
selectedId: string                             // conversation or message id
```

Put `mode`, `status`, `type`, `query`, and `selectedId` in the URL so views are linkable and the back button works.

**Data needs**
- `GET /admin/conversations?status&type&q&sort&page` → list rows (participants, last message preview, timestamp, message count, type, flags).
- `GET /admin/messages?status&type&q&sort&page` → message rows (from, to, body, timestamp, type, sku, flags, conversationId).
- `GET /admin/conversations/:id/messages` → full thread for the reading pane.
- `GET /admin/messages/facets?status&type&q` → live counts for both rails (must respect the other axis).
- `POST /admin/messages/:id/flag`, `DELETE /admin/messages/:id`, `POST /admin/conversations/:id/resolve`, `POST /admin/conversations/:id/notes`, `POST /admin/conversations/:id/assign`.

The list must paginate or virtualize — 67 rows today, but this table only grows.

---

## Design Tokens

### Color
| Role | Hex |
|---|---|
| Page background | `#f6f6fa` |
| Surface | `#ffffff` |
| Surface, subtle (rails, inputs) | `#fbfbfd` / `#fcfcfe` |
| Border | `#ececf3` |
| Border, light (row divider) | `#f4f4f8` / `#f0f0f5` |
| Border, control | `#e3e3ec`, hover `#cfcfe0` |
| Border, input | `#e6e6ee` |
| Text primary | `#17161c` |
| Text body | `#2c2b36` / `#3d3c49` / `#4a4956` |
| Text secondary | `#6b6a78` |
| Text muted | `#8b8a99` / `#9a99a8` |
| Text faint | `#a8a7b5` / `#b3b2c0` |
| Primary | `#7c3aed`, hover `#6d28d9` |
| Primary text-on-tint | `#6d28d9` / `#5b21b6` |
| Primary tint | `#f2edff` / `#f1ecff` / `#faf8ff` |
| Row selected | `#f7f4ff`; row hover `#fafaff` |
| Success | `#16a34a` on `#e9f8ef` |
| Warning | `#b45309` on `#fef3c7`; banner `#fffaf2` / `#fde4c8`; flag border `#f59e0b` |
| Danger | `#b91c1c` / `#dc2626` on `#fee2e2`; border `#f3c9c9`; hover bg `#fff7f7` |
| Info (escrow) | `#0369a1` on `#e0f2fe` |
| Neutral chip | `#6b6a78` on `#f1f1f6` |
| Dark button | `#17161c` |

**Participant avatar colors** (hash the user id onto this list): `#e11d48` `#7c3aed` `#0ea5e9` `#d97706` `#4f46e5` `#0f766e` `#be185d` `#4a4956`.

### Typography
Plus Jakarta Sans (400/500/600/700/800) for UI; JetBrains Mono (400/500) for SKUs, ids, and timestamps in the log view. Both from Google Fonts — swap for the codebase's licensed copies if it self-hosts.

| Use | Size / weight / tracking |
|---|---|
| H1 | 26px / 800 / `-0.03em` |
| Pane title | 15.5px / 800 / `-0.02em` |
| Section title | 15px / 700 / `-0.01em` |
| Body, bubble | 13.5px / 400 / line-height 1.5 |
| Row title | 13.5px / 700 / `-0.01em` |
| Row preview, control | 13px / 400–600 |
| Meta | 12.5px / 400 |
| Caption | 11.5–12px / 400–700 |
| Rail heading | 10.5px / 700 / `.1em` uppercase |
| Chip | 10.5–11px / 700 / `.05em` uppercase |

### Spacing
4 / 6 / 9 / 10 / 11 / 12 / 14 / 16 / 18 / 20 / 24px. Pane padding 14–20px; row padding 12px 14px; control padding `0 13–16px`.

### Radius
5 (key hint) · 6–7 (chip) · 8 (segment) · 9 (rail row, small control) · 10 (nav item, input, button) · 11–12 (card) · 14 (bubble) · 16 (large card) · 20 (date pill) · 50% (avatar).

### Elevation
Effectively flat. Borders carry the hierarchy. Only two shadows exist: primary button `0 1px 2px rgba(124,58,237,.35)` and (in the table variant) drawer `-24px 0 60px rgba(23,22,28,.12)`.

### Control heights
32 (segment, small) · 34 (pane action) · 36 (list search) · 38 (header control, note input) · 40–42 (table toolbar) · 44 (queue decision button).

---

## Assets

No images or illustrations. All icons in the prototype are Unicode glyph placeholders (`◎ ⚑ ◔ ◑ ✓ ◫ ▤ ⌕ ⤓ ⋯ ↔ →`) — **replace every one** with the codebase's real icon component. Avatars are generated initials, no uploads. Fonts are the two Google families above.

---

## Files

| File | What it is |
|---|---|
| `Messages Triage.dc.html` | **The design to build.** The merged three-pane triage inbox. |
| `reference/Messages Admin (table view).dc.html` | Earlier iteration — the Messages page as an improved data table with tabs, bulk-select toolbar, and a thread drawer. Useful if the team prefers a table-first default, and its bulk-action bar is worth stealing. |
| `reference/Messages Alternatives (3 patterns).dc.html` | Three explored patterns side by side: **1a** triage inbox (chosen), **1b** one-at-a-time moderation queue with policy picker and strike history, **1c** log console with query bar, facets, volume histogram, and JSON row expansion. |
| `support.js` | Prototype runtime only. **Do not port.** |

Open any `.dc.html` directly in a browser.

---

## Not Yet Designed

Flag these back to the design owner rather than inventing them:

1. **Reply composer** for escrow and Contact Us threads — currently only the admin-only note bar exists.
2. **Assignment UI** — who assigns an escrow thread, and how. Only the resulting statuses are designed.
3. **Resolve reason codes** — does closing a thread require a category?
4. **Disabled statuses** — greying out Awaiting reply / Assigned to me when Type = Buyer ↔ Seller.
5. **Bulk actions in triage mode** — the table variant has them; the triage list does not.
6. **Delete confirmation dialog** and the `⋯` overflow menu.
7. **Tablet/mobile** — desktop-only by design.
8. **Escalation path** — pattern 1b sketches Escalate, but it is not in the chosen design.
