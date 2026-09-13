# Admin user form: genuine Myanmar-script NRC entry

## What changed

- `features/users/data/myanmar-nrc-townships.json` — regenerated from the
  [`chuuhtetnaing/myanmar-nrc-format-dataset`](https://huggingface.co/datasets/chuuhtetnaing/myanmar-nrc-format-dataset)
  dataset on Hugging Face, keyed by that dataset's `state_code` field. 428 townships across the 14
  states/regions, each `value` being that dataset's `township_code_mm` field (the real
  Myanmar-script township abbreviation), `label` being `"<township_mm> (<township_en>)"`.
- `lib/nrc.ts`:
  - Added `NRC_CITIZEN_TYPES_MM` (the real Myanmar spelling for each citizen-type code) and
    `toMyanmarDigits` / `fromMyanmarDigits` (ASCII digit ⟷ Myanmar Unicode digit conversion).
  - Corrected `NRC_CITIZEN_TYPES`' English glosses: `E` is Associate (was mislabeled Honorary),
    `P` is Naturalized (was mislabeled Associate), `T` is the Religious/Sasana category (was
    mislabeled Naturalized — its real Myanmar spelling is `သာသနာ`, not the invented `သီး`).
- `features/users/components/UserForm.tsx` (create and edit forms):
  - The Myanmar NRC picker now assembles a **genuine Myanmar-script NRC** — e.g.
    `၉/မလန(နိုင်)၁၂၃၄၃၃` — instead of a Latin transliteration. State number and serial are
    converted to Myanmar numerals via `toMyanmarDigits`; township comes straight from the
    (now Myanmar-script) townships JSON; citizen type is looked up from `NRC_CITIZEN_TYPES_MM`.
  - `NRC_TYPE_OPTIONS` now offers all four real citizen types with Myanmar labels
    (`နိုင်`/`ဧည့်`/`ပြု`/`သာသနာ`), replacing a dropdown that only ever offered two
    representations (`N` and `NAING`) of the same type.
  - `parseMyanmarNrc` (used to populate the edit form from an existing `user.nrc`) now parses
    **either** the legacy Latin format or the new Myanmar-script format, normalizing Myanmar
    digits back to decimal and a Myanmar-word type back to its `N/P/T/E` code.
  - State `<select>` labels gained their Myanmar names (e.g. `"9 - Mandalay (မန္တလေး)"`).
  - Township and citizen-type `<option>` elements carry a fallback `<option>` for a stored value
    that doesn't match any known entry, so editing an old/unusual record never silently drops
    the value from the dropdown.
- `tests/unit/myanmar-nrc-townships.test.ts` and `tests/unit/nrc.test.ts` updated/extended to
  cover the new format and the digit-conversion helpers.

## Why

The admin "create/edit user" NRC picker previously assembled a Latin-format string
(`${state}/${township}(${type})${serial}`) using township codes that didn't match `lib/nrc.ts`'s
required 3-letter Latin shape, so every real township selection failed `nrcSchema` validation
with "Invalid NRC format...". A first pass fixed the Latin codes to be exactly 3 letters, but the
user pointed out the mobile app and real Myanmar NRC cards render entirely in Myanmar script
(e.g. `၉/မလန(နိုင်)၁၂၃၄၃၃`), and asked the admin form to match that — not a Latin transliteration.
Fabricating official Myanmar-script township abbreviations would risk introducing wrong identity
data, so this fix instead sources them from the `chuuhtetnaing/myanmar-nrc-format-dataset`
reference dataset rather than guessing.

## Data flow

`UserForm` (create/edit) → local `nrcState`/`nrcDistrict`/`nrcType`/`nrcNumber` state → assembled
into `nrcFinal` (via `toMyanmarDigits` + `NRC_CITIZEN_TYPES_MM`) → submitted as the `nrc` form
field → `createUserAction` / `updateUserAction` (`features/users/actions/users.ts`) →
`userCreateSchema` / `userUpdateSchema` (`features/users/schemas/users.ts`, both use `nrcSchema`
from `lib/nrc.ts`) → `updateUserInDb` / `auth.api.signUpEmail` → Postgres `user.nrc` (unique index
`user_nrc_unique`).

## Schema impact

None — no Drizzle schema or migration changes. `user.nrc` is a plain `text` column; it now stores
Myanmar-script strings for new admin-entered records instead of Latin ones, which `lib/nrc.ts`'s
`NRC_REGEX` already accepted as a valid alternative format.

## Auth & permissions

Unchanged. `createUserAction`/`updateUserAction` still require an authenticated session via
`requireActionRole` (admin/internal role gate).

## Edge cases & known limitations

- **Naypyidaw** uses a special state marker (`9*`) on real NRC cards, which this app's 14-state
  picker doesn't support (matching its pre-existing scope); the source dataset doesn't include a
  separate Naypyidaw state code, so this doesn't come up.
- **Duplicate township codes**: a handful of townships (mostly in state 13, Shan) share their
  township code with another township in the same state (a real-world quirk of the source data,
  not something introduced here); the 6-digit serial still guarantees NRC uniqueness at the DB
  level regardless.
- **Backward compatibility**: existing users whose `nrc` was saved in the old Latin format
  (either from before this fix, or from the mobile app) are unaffected — `parseMyanmarNrc` and
  `lib/nrc.ts`'s `NRC_REGEX` still accept the Latin format, so those records display and validate
  correctly. Only new selections from the admin dropdown produce Myanmar-script values.
- **Citizen type `Y` (Temporary) and `S`**, present in the source dataset's type list but not part
  of `lib/nrc.ts`'s 4 supported types, are not offered in the dropdown — out of scope for this
  fix (mirrors what the mobile app and `nrcSchema` support today).

## Follow-up fix: KYC review card falsely flagged valid NRCs

`features/users/components/KycDocumentsCard.tsx` (the admin KYC-review widget shown on a user's
edit page) had its **own** local `NRC_REGEX` and `parseNrc`, duplicated from an earlier version of
`lib/nrc.ts` and never kept in sync. It only matched the Latin format with a bare `N`/`NAING`
citizen type, so it always showed **"Number format invalid"** for:

- any genuine Myanmar-script NRC (e.g. one submitted through `/api/mobile/register`, which
  already supports Myanmar script — see `lib/nrc.ts`), and
- any Latin NRC using the `P`, `T`, or `E` citizen type.

This was a false negative only in this one review-card display — the NRC itself was always
correctly validated and stored by `nrcSchema` at write time; the KYC card was just re-deriving
"valid" with stale logic instead of asking the canonical validator.

**Fix**: `KycDocumentsCard.tsx` now imports `parseNrc` and the new `NRC_STATE_NAMES` export from
`lib/nrc.ts` instead of maintaining its own regex/parser/state-name map. `NRC_STATE_NAMES`
(state number → English name) was extracted from this component into `lib/nrc.ts` since it's
generic NRC domain data, not component-specific.

Covered by 3 new tests in `tests/component/KycDocumentsCard.test.tsx`: a Myanmar-script NRC and a
Latin `P`-type NRC both now show "Number format valid"; a genuinely malformed value still shows
"Number format invalid".
