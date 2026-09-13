# NRC field redesign: composite township-search card

## What changed

- Added `features/users/components/NrcField.tsx` — a new composite control that replaces the
  previous 4-dropdown "Identification number" row (State/Region, District, Type, Number selects)
  on the admin user form (`Users › New user` / `Users › Edit user`) with a self-contained
  "National Registration Card" card, recreated from the design handoff in
  `design_handoff_nrc_field/` (`README.md` + `GemX NRC Field.dc.html`):
  - **State / Region** — native `<select>`, Myanmar-numeral + short Myanmar-name options
    (e.g. `၉ - မန္တလေး`), helper line showing the full Myanmar name + English name.
  - **Township code** — a searchable combobox (button trigger + popover), showing the township
    code as a purple badge next to its Myanmar name, filtered by a live search over code or name,
    with click-outside-to-close, Esc-to-close, autofocus on open, and ↑/↓/Enter keyboard
    selection (the handoff explicitly asked for these beyond what its static prototype covered).
  - **Citizenship type** — a 4-segment control (previously a dropdown), covering the same
    N/E/P/T codes as before (the handoff's own prototype only modeled 3 types; this app already
    supports and validates a 4th, `T`/`သာသနာ`, so it was kept rather than dropped).
  - **Number** — a 6-digit input with a live "n/6" count and a "needs six digits" warning state.
  - **Preview strip** — shows the assembled Myanmar-script NRC ("AS STORED"), a Latin-digit
    reading aid (state number and serial only — never saved), and a "Ready for KYC review" /
    "Incomplete" status pill.
- `features/users/data/nrc-townships.ts` reshaped its exports for this component's needs:
  `NRC_STATES: { value, nameMm, nameShortMm }[]` (sorted 1–14) and
  `NRC_TOWNSHIPS_BY_STATE: Record<state, { code, name }[]>`, plus `NRC_TOWNSHIP_COUNT` (426, shown
  in the card header pill). The underlying canonical data file itself
  (`features/users/data/nrc-townships-mm.json`) is unchanged from the earlier canonical-source
  migration (see `docs/technical/nrc-townships-canonical-source.md`).
- `lib/nrc.ts`: added `buildMyanmarNrc({state, township, type, number})`, the one place that
  assembles a Myanmar-script NRC string from its four parts — used by both `NrcField`'s live
  preview and `UserForm.tsx`'s submitted value, so the two can't drift apart.
- `features/users/components/UserForm.tsx` (create and edit forms): both now render
  `<NrcField value={nrc} onChange={...} />` when `country === "Myanmar"`, replacing the old
  per-part `<NrcSelect>` dropdowns (now deleted) and the ad-hoc `nrcState`/`nrcDistrict`/
  `nrcType`/`nrcNumber` state with one `nrc: NrcValue` object. `parseMyanmarNrc` (decodes an
  existing user's stored `nrc` string into the 4 parts on page load) is unchanged.
- `app/admin-list-view.css`: added a new `.nrc-*` rule block (card, grid, select, township
  trigger/popover/list, segmented control, number input, preview strip) styled to the handoff's
  design tokens (colors, spacing, radii, shadows).

## Why

The client supplied a high-fidelity design handoff (`design_handoff_nrc_field/`) for the admin
NRC field, built against the same canonical `state_township_mm.json` township table already
wired up as `features/users/data/nrc-townships-mm.json`. The old 4-dropdown UI is replaced with
the searchable-combobox design; scope stays UI-only, matching the earlier decision for the
canonical-source migration — `lib/nrc.ts`'s `NRC_REGEX`/`validateNrc` (shared by the mobile
register/profile/social-login routes) is untouched.

## Data flow

`features/users/data/nrc-townships-mm.json` → `nrc-townships.ts` (`NRC_STATES`,
`NRC_TOWNSHIPS_BY_STATE`, `NRC_TOWNSHIP_COUNT`) → `NrcField` (controlled component: `value: NrcValue`
+ `onChange`) → `UserForm.tsx`'s `nrc` state → `buildMyanmarNrc(nrc)` → submitted as the `nrc` form
field → `createUserAction`/`updateUserAction` → `nrcSchema` (`lib/nrc.ts`) → Postgres `user.nrc`.
Unchanged from before this redesign, except the intermediate representation is now one `NrcValue`
object instead of four separate `useState` calls.

## Schema impact

None. No Drizzle schema or migration changes.

## Auth & permissions

Unchanged — still gated by `requireActionRole` in `createUserAction`/`updateUserAction`.

## Edge cases & known limitations

- **State → township dependency**: per the handoff, changing the state auto-selects that state's
  first township (sorted by code) rather than clearing the field — "an impossible (state,
  township) pair can never be submitted." This only applies to an explicit state change the admin
  makes; loading an existing user's already-stored (state, township) pair is never auto-corrected
  (see next point).
- **Legacy/unrecognized township values**: if an existing user's stored NRC has a township code
  that isn't in the canonical table (old data, or a data-entry mismatch), `NrcField` still shows
  and preserves that raw code (badge + "Unrecognized township code") instead of silently
  replacing it with the state's first township — consistent with the pre-existing "never drop an
  unusual value" principle from the original NRC form fix.
- **Duplicate township codes within a state** (mostly Shan/state 13, a real-world data quirk):
  unaffected by this change — `.code` is still the unique React key per rendered option, so any
  actual duplicate would produce a key warning, same as before this redesign.
- **Latin-digit preview line** is a read-only aid — state number and 6-digit serial rendered in
  ASCII, township code and citizen type stay in Myanmar script (matching real card conventions);
  it is never part of the submitted value.
- Non-Myanmar country selections keep the original plain free-text ID input — untouched.
