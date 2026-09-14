# Handoff: NRC (National Registration Card) identification field

## Overview
A redesign of the **Identification number (NRC)** block on the GemX admin panel's user form
(Users › New user / Edit user). It replaces the previous four generic dropdowns
("State/Region", "District", "Type", "Number") with a composite control driven by the official
Myanmar state–township code table, plus a live preview of the value that will be stored.

The NRC is one logical value made of four parts, in the order printed on the card:

    <state code> / <township code> ( <citizenship type> ) <6 digits>
    ၁၂/ကကက(နိုင်)၁၂၃၄၅၆

## About the Design Files
The files in this bundle are **design references created in HTML** — a prototype showing the
intended look and behaviour. They are not production code to lift as-is. The task is to
**recreate this design inside the target codebase** using its existing framework, component
library and form primitives (React/Vue/Blade/etc.). If the admin panel has no established
pattern for a combobox, pick the one the rest of the app would use.

`nrc-townships.json` is the exception: it is **real data** (426 rows) and should be carried over
or replaced by the equivalent server-side table.

## Fidelity
**High fidelity.** Final colours, typography, spacing and interaction behaviour. Recreate the UI
closely; where the admin panel already has form-field, select and popover components, use those
and map the values below onto them rather than hand-rolling new ones.

## Data
`nrc-townships.json` — flat array, 426 rows, one per township:

    { "state_code": "၁", "township_code_mm": "ကပတ", "township_mm": "ကန်ပိုက်တီ", "state_mm": "ကချင်ပြည်နယ်" }

- `state_code` — Burmese numeral, "၁" … "၁၄" (string, not a number).
- `township_code_mm` — the three-Burmese-letter code printed on the card. **Not unique across
  states** (e.g. "ကတတ" exists in both ၁၂ and ၁၃), so a township is identified by the
  *pair* (state_code, township_code_mm).
- `township_mm` — full township name in Burmese, used as the human label only.
- `state_mm` — full state/region name in Burmese.

Row counts per state: ၁ Kachin 31 · ၂ Kayah 8 · ၃ Kayin 17 · ၄ Chin 13 · ၅ Sagaing 45 ·
၆ Tanintharyi 17 · ၇ Bago 34 · ၈ Magway 27 · ၉ Mandalay 38 · ၁၀ Mon 13 · ၁၁ Rakhine 19 ·
၁၂ Yangon 45 · ၁၃ Shan 87 · ၁၄ Ayeyarwady 32.

English state names are **not in the data**; the prototype carries this map:

    ၁ Kachin, ၂ Kayah, ၃ Kayin, ၄ Chin, ၅ Sagaing, ၆ Tanintharyi, ၇ Bago,
    ၈ Magway, ၉ Mandalay, ၁၀ Mon, ၁၁ Rakhine, ၁၂ Yangon, ၁၃ Shan, ၁၄ Ayeyarwady

Citizenship types (fixed list of three): `နိုင်` Citizen · `ဧည့်` Associate citizen ·
`ပြု` Naturalised citizen.

## Screens / Views

### View: NRC block inside the user form
**Purpose** — an admin types or confirms a user's NRC during KYC review.

**Layout**
- Page padding 28px top / 24px sides / 56px bottom, background `#F4F5F8`, content max-width
  1180px centred, vertical gap 18px between the three stacked groups (intro, card, notes).
  In the real admin panel this block sits inside the existing form column — drop the intro and
  notes blocks and keep only the card if the surrounding page already has a section header.
- **Card**: white, 1px `#E4E6EE`, radius 14, shadow `0 1px 2px rgba(26,28,35,.04)`.
- **Card header** (padding 16/20, bottom border 1px `#EEF0F5`): 30×30 radius-9 `#F1ECFF` tile with
  a 16px ID-card icon stroked `#6D3BEB` (stroke-width 1.9); title "National Registration Card"
  14/700; subtitle "Used for KYC review. Visible to admins only." 11.5 `#8A90A2`; right-aligned
  pill (radius 999, `#F5F6FA`, 1px `#E4E6EE`, padding 5/11) reading "426 TOWNSHIP CODES"
  10.5/700/0.08em `#6B7280` (shows "LOADING TABLE" until the table resolves).
- **Field row**: CSS grid, padding 20/20/8, gap 14, columns
  `minmax(0,1.05fr) minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr)`, `align-items:start`.
  Below ~900px this should stack to two columns (state + township, then type + number).
- Every field: label row (11.5/700 `#1A1C23`, required asterisk 11.5 `#C0392B`, optional
  right-aligned meta 10.5 `#8A90A2`), control 44px tall, radius 10, 1px `#D7DAE4`, white,
  then helper text 11 `#8A90A2`. Label→control gap 6.

**1 · State / Region** (column 1)
- Native select, appearance none, padding `0 32px 0 12px`, value 13.5/500 `#1A1C23`;
  14px chevron `#8A90A2` absolutely placed right 11, top 15, `pointer-events:none`.
- Option label format: `၁ - ကချင်` — Burmese numeral, space-hyphen-space, **short** Burmese
  state name (full name with `ပြည်နယ်` / `တိုင်းဒေသကြီး` stripped). Options sorted by the
  numeral's numeric value (၁…၁၄), not string order.
- Helper line under the field: full Burmese state name + " · " + English name, in
  Noto Sans Myanmar 11 `#8A90A2`.
- Default value: `၁၂` (Yangon).

**2 · Township code** (column 2) — custom combobox
- Trigger (44px, padding `0 11px 0 12px`, gap 9, cursor pointer): code badge —
  Noto Sans Myanmar 14/600, `#4B25B5` on `#F1ECFF`, radius 6, padding 3/8, letter-spacing .02em;
  then township name Noto Sans Myanmar 13.5 `#3A3F4E`, `flex:1`, single line, ellipsis;
  then 14px chevron `#8A90A2`.
- Meta on the label row: "45 in this state". Helper: "Search by code or township name".
- **Popover** (open state): absolutely positioned `top:74px; left:0; right:0`, z-index 20,
  white, 1px `#D7DAE4`, radius 12, shadow `0 18px 40px rgba(26,28,35,.16)`, overflow hidden.
  - Search row: padding 10, bottom border 1px `#EEF0F5`, 15px magnifier `#8A90A2`, borderless
    input 13.5 with placeholder "ကမရ or ကျိုက်မရော" (Noto Sans Myanmar).
  - List: `max-height:264px; overflow:auto`. Row = padding 9/12, gap 10, bottom border 1px
    `#F5F6FA`, hover `#F8F6FF`: code (Noto Sans Myanmar 13.5/600 `#4B25B5`) · name
    (13 `#3A3F4E`, flex 1, ellipsis) · "selected" marker 11 `#A6ABBA` on the current row.
  - Empty state: "No township code matches that search inside this state." 12.5 `#8A90A2`,
    padding 16/12.
  - In production also add: click-outside to dismiss, Esc to close, ↑/↓/Enter keyboard
    selection, and focus moved into the search input on open (the prototype omits these).

**3 · Citizenship type** (column 3) — segmented control
- Track: 44px, `#F5F6FA`, 1px `#E4E6EE`, radius 10, padding 4, gap 6, three equal segments.
- Segment: radius 7, centred, Noto Sans Myanmar 13.5/600. Selected — white fill, text = accent
  `#6D3BEB`, 1px `#DFD6FB`, shadow `0 1px 2px rgba(26,28,35,.12)`. Unselected — `#6B7280`,
  transparent border.
- Helper line shows the English meaning of the selected type ("Citizen").

**4 · Number** (column 4)
- Text input, `inputMode="numeric"`, padding 0 12, font 14, letter-spacing .06em,
  placeholder "123456". Non-digits stripped, hard max 6 characters.
- Label meta: live count "6/6". Helper: "Six digits, as printed" `#8A90A2`; when 1–5 digits
  have been typed the border becomes `#E0A6A0` and the helper "Needs six digits" `#B23A2C`.
  An empty field is neutral, not an error.

**5 · Preview strip** (full width, margin 4/20/20)
- `#FAFAFC`, 1px `#EDEFF4`, radius 12, padding 14/16, flex, wrap, gap 18, centred.
- "AS STORED" 10.5/700/0.09em `#8A90A2` over the assembled value in Noto Sans Myanmar 22/600
  `#1A1C23` — all-Burmese numerals: `၁၂/ကကက(နိုင်)၁၂၃၄၅၆`.
- 1px `#E7E9F0` vertical divider.
- "LATIN DIGITS" over `12/ကကက(နိုင်)123456` — 18/500 `#5D6376`. Reading aid only; never saved.
- Right: status pill (white, 1px `#E4E6EE`, radius 999, padding 6/12) — 7px dot +
  11.5/600 `#3A3F4E`. Complete = dot `#2F6B4F` "Ready for KYC review";
  incomplete = dot `#C9A24D` "Incomplete".

**6 · Notes row** (below the card) — three white cards, radius 12, 1px `#E4E6EE`, padding 14/16,
grid `repeat(auto-fit,minmax(240px,1fr))`, gap 12; title 12/700, body 11.5/1.55 `#5D6376`.
Documentation for the reviewer — **do not ship inside the form**.

## Interactions & Behavior
- **State → township dependency.** Changing the state resets the township code to the first
  entry of that state and clears the search query. An impossible (state, township) pair can
  never be submitted.
- **Township search** filters within the selected state only, matching `township_code_mm`
  *or* `township_mm` with a plain substring test on the trimmed query (Burmese input). The
  prototype caps the rendered list at 120 rows; use virtualisation or the same cap for Shan (87).
- **Type** selection is immediate, no confirm.
- **Number** input sanitises on every keystroke (digits only, max 6).
- **Preview** recomputes on every change of any part.
- Validation: all four parts required; number exactly 6 digits; township must belong to the
  selected state. Show one error under the composite row rather than four field-level errors.
- No animations or transitions beyond the default hover colour change.
- Responsive: the four-column grid should collapse to 2 columns then 1; controls stay 44px so
  they remain touch-safe.

## State Management
    nrc = { stateCode: '၁၂', townshipCode: 'ကကက', typeIndex: 0, number: '123456' }
    ui  = { open: false, query: '' }
    data = { rows: TownshipRow[] }   // fetched once, cache app-wide

Transitions: `pickState(code)` → sets stateCode, resets townshipCode to first in state, clears
query, closes popover · `pickTownship(code)` → sets townshipCode, closes popover, clears query ·
`setType(i)` · `setNumber(raw)` → strip non-digits, slice(0,6) · `toggleOpen()`.

Data fetching: the township table is static reference data — ship it as a bundled JSON asset or
serve it from an endpoint with long cache headers. 426 rows is small enough to hold in memory.

Persisted value: store the four parts separately (recommended) and derive the display string, or
store the canonical Burmese string and parse with
`/^([၀-၉]{1,2})\/(\S{3})\((နိုင်|ဧည့်|ပြု)\)([၀-၉]{6})$/`.

## Design Tokens
Colours
- Page background `#F4F5F8` · surface `#FFFFFF` · inset surface `#FAFAFC` · segmented track `#F5F6FA`
- Borders: `#E4E6EE` (card), `#EEF0F5` (header divider), `#D7DAE4` (control), `#EDEFF4` (preview),
  `#F5F6FA` (list row), `#E7E9F0` (divider), `#DFD6FB` (selected segment)
- Text: `#1A1C23` primary · `#3A3F4E` secondary · `#5D6376` body · `#6B7280` muted ·
  `#8A90A2` helper · `#A6ABBA` faint
- Accent `#6D3BEB`, hover `#5629D6`, deep `#4B25B5`, tint `#F1ECFF`, hover row `#F8F6FF`
- Status: success `#2F6B4F` · pending `#C9A24D` · required asterisk `#C0392B` ·
  error text `#B23A2C` · error border `#E0A6A0`

Spacing — 4 / 5 / 6 / 9 / 10 / 11 / 12 / 14 / 16 / 18 / 20 / 24 / 28 px.
Radius — 6 (code badge) · 7 (segment) · 9 (icon tile) · 10 (control) · 12 (popover, notes) ·
14 (card) · 999 (pill).
Shadows — card `0 1px 2px rgba(26,28,35,.04)` · segment `0 1px 2px rgba(26,28,35,.12)` ·
popover `0 18px 40px rgba(26,28,35,.16)`.
Control height 44. Card content width 1180 max.

Typography
- Latin: **Schibsted Grotesk** 400/500/600/700 (Google Fonts).
- Burmese: **Noto Sans Myanmar** 400/500/600/700 — required on every element that can contain
  Burmese (state options, township code and name, type labels, both preview lines, the search
  input and its placeholder). Do not let Burmese fall back to a Latin family.
- Scale: 10.5 micro-caps (0.08–0.09em tracking, 700) · 11 helper · 11.5 label/body (700 labels) ·
  12 note title · 12.5 empty state · 13 list name · 13.5 control value · 14 number input, code
  badge, card title · 18 latin preview · 22 stored preview.

## Assets
- `nrc-townships.json` — the 426-row state/township table (derived verbatim from the
  `state_township_mm.json` the client supplied; no values altered).
- Icons are inline SVG, 24×24 viewBox, stroke-only (ID card, chevron down, magnifier). Replace
  with the admin panel's existing icon set.
- No images or raster assets.

## Files
- `GemX NRC Field.dc.html` — the interactive design reference (open in a browser; it loads
  `nrc-townships.json` from the same folder and needs `support.js` beside it).
- `nrc-townships.json` — the data.
- `support.js` — runtime for the prototype only; not part of the design.
