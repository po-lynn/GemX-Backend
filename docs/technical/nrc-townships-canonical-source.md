# Myanmar NRC state/township data: single canonical source

## What changed

- Added `features/users/data/nrc-townships-mm.json` — the canonical Myanmar NRC state/township
  reference data (426 townships across the 14 states/regions), each entry shaped
  `{ state_code, township_code_mm, township_mm, state_mm }` with `state_code` as Myanmar-script
  digits. This file replaces the previous `features/users/data/myanmar-nrc-townships.json`
  (which was keyed by decimal state number and included an English township gloss) as the one
  dataset the app uses for Myanmar NRC state/township values.
- Added `features/users/data/nrc-townships.ts` — a small transform module that loads the raw
  JSON once and derives the two lookup shapes the UI needs:
  - `NRC_TOWNSHIPS_BY_STATE: Record<string, { value: string; label: string }[]>` — keyed by
    decimal state number `"1"`–`"14"`, `value` is `township_code_mm`, `label` is
    `` `${township_code_mm} — ${township_mm}` `` (no English gloss — the source data doesn't
    carry one).
  - `NRC_STATE_NAMES_MM: Record<string, string>` — Myanmar-script state/region name (`state_mm`),
    keyed by decimal state number.
  - State numbers are recovered from the Myanmar-digit `state_code` via `lib/nrc.ts`'s existing
    `fromMyanmarDigits`, so there's one digit-conversion implementation, not two.
- `features/users/components/UserForm.tsx`:
  - `MYANMAR_NRC_DISTRICTS_BY_STATE` now points at `NRC_TOWNSHIPS_BY_STATE` instead of the
    deleted JSON import.
  - `MYANMAR_NRC_STATES` (the state `<select>` options) is now generated from
    `NRC_STATE_NAMES_MM` (Myanmar name) plus `lib/nrc.ts`'s existing `NRC_STATE_NAMES` (English
    name) instead of being a hand-maintained array of 14 literal objects — this also fixes the
    displayed Myanmar state names to be the full official form (e.g. `ကချင်ပြည်နယ်`, "Kachin
    State") rather than the bare short name (`ကချင်`) that was hardcoded before.
- `tests/unit/myanmar-nrc-townships.test.ts` replaced by `tests/unit/nrc-townships.test.ts`,
  updated to import from the new module instead of the deleted JSON.

## Why

Township/state reference data for the admin NRC picker previously lived in a hand-maintained
JSON file, separately from any other Myanmar NRC data in the codebase. The user supplied
`state_township_mm.json` as the dataset both the mobile and web backends should treat as the one
canonical source for Myanmar NRC state/township values, so this change retires the old JSON and
routes the admin UI through the new file instead. Scope was deliberately limited to swapping the
data source that feeds the admin picker's dropdowns — `lib/nrc.ts`'s `NRC_REGEX`/`validateNrc`
(used by `/api/mobile/register`, `/api/mobile/profile`, `/api/mobile/social-login`, and the admin
form) remains a shape-only regex and does not cross-check township codes against this dataset, to
avoid retroactively rejecting previously-accepted NRC values.

## Data flow

`features/users/data/nrc-townships-mm.json` (raw canonical data) → `nrc-townships.ts` (parses
`state_code` via `fromMyanmarDigits`, groups into `NRC_TOWNSHIPS_BY_STATE` /
`NRC_STATE_NAMES_MM`) → `UserForm.tsx` (`MYANMAR_NRC_DISTRICTS_BY_STATE`, `MYANMAR_NRC_STATES`) →
rendered as the State/Region and District `<Select>` pickers → assembled into the Myanmar-script
NRC string exactly as before (unchanged: `toMyanmarDigits` + `NRC_CITIZEN_TYPES_MM`) → submitted
as the `nrc` form field → `createUserAction`/`updateUserAction` → `nrcSchema` (`lib/nrc.ts`) →
Postgres `user.nrc`.

## Schema impact

None. No Drizzle schema or migration changes; `user.nrc` storage format is unaffected.

## Auth & permissions

Unchanged — this is a data-source swap behind the existing admin user form, still gated by
`requireActionRole` in `createUserAction`/`updateUserAction`.

## Edge cases & known limitations

- The new dataset has no English township names, so township option labels are now
  `"<code> — <Myanmar name>"` instead of `"<code> — <Myanmar name> (<English name>)"`. State
  labels still show an English name, sourced from `lib/nrc.ts`'s existing `NRC_STATE_NAMES` map
  (unchanged, hand-maintained), combined with the new dataset's Myanmar name.
- State 13 (Shan) still has a handful of townships sharing the same `township_code_mm` within
  that state — a pre-existing real-world data quirk (also present in the old dataset), not
  introduced by this change; the NRC's 6-digit serial plus the DB's `user_nrc_unique` index still
  guarantee overall uniqueness.
- Backend NRC format validation (`lib/nrc.ts`) is intentionally untouched — see "Why" above.
