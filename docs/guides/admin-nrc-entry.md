# Entering a Myanmar NRC in the admin panel

## Prerequisites

- Admin/internal session (`/admin/users/new` or `/admin/users/[id]/edit`, "Profile" tab).
- No env vars or extra dependencies needed.

## Using it

1. Set **Country** to `Myanmar` on the user's address section — this switches the free-text ID
   field into the "National Registration Card" picker (`features/users/components/NrcField.tsx`).
2. Fill in, in order:
   - **State / Region** — a native select of the 14 states/regions
     (`features/users/data/nrc-townships.ts`'s `NRC_STATES`), option labels like `၉ - မန္တလေး`;
     the helper line under it shows the full Myanmar name plus the English name.
   - **Township code** — click the trigger to open a search popover scoped to the selected
     state; type part of a code or name to filter, then click a row (or use ↑/↓/Enter) to pick
     it. Changing the state auto-picks that state's first township, so you always start from a
     valid pair.
   - **Citizenship type** — a 4-way segmented control: `နိုင်` (Citizen), `ဧည့်` (Associate),
     `ပြု` (Naturalized), `သာသနာ` (Religious/Sasana).
   - **Number** — the 6-digit serial (non-digits are stripped as you type).
3. The preview strip at the bottom of the card shows the assembled Myanmar-script NRC (what's
   actually submitted, e.g. `၉/မလန(နိုင်)၁၂၃၄၃၃`) plus a Latin-digit reading aid, and a
   ready/incomplete status pill. The four parts are joined client-side via `lib/nrc.ts`'s
   `buildMyanmarNrc` and submitted as the single `nrc` field. Non-Myanmar countries keep the
   plain free-text ID input instead.

## Extending it

- **Add/relabel a township or state**: edit `features/users/data/nrc-townships-mm.json` — the
  single canonical dataset (shared reference for the admin web picker and, going forward, any
  mobile/web backend NRC data needs), each entry shaped
  `{ state_code, township_code_mm, township_mm, state_mm }` with `state_code` as Myanmar-script
  digits. `nrc-townships.ts` derives `NRC_STATES`/`NRC_TOWNSHIPS_BY_STATE`/`NRC_TOWNSHIP_COUNT`
  from it automatically — no other file needs updating for a data-only change. Every
  `township_code_mm` must stay 1-10 Myanmar Unicode characters (`^[က-႟]{1,10}$`) — `lib/nrc.ts`'s
  `NRC_REGEX` rejects anything else, and `tests/unit/nrc-townships.test.ts` /
  `tests/component/NrcField.test.tsx` enforce the shape and the picker's behavior. Don't
  hand-write new township codes — source them from a verified reference rather than guessing,
  since these are real identity-document values. Adding a 15th state/region also needs its
  English name added to `NRC_STATE_NAMES` in `lib/nrc.ts` (Myanmar name comes from the JSON;
  English name doesn't).
- **Add a citizen type**: types are defined once in `lib/nrc.ts`'s `NRC_CITIZEN_TYPES` /
  `NRC_CITIZEN_TYPES_MM` — `NrcField`'s segmented control renders one segment per entry in
  `NRC_CITIZEN_TYPES` automatically, so adding a type there is enough to add it to the admin UI
  too (make sure `lib/nrc.ts`'s `NRC_REGEX`/mobile validation also accept the new code).
- **Change the card's visual design**: all of it lives in `NrcField.tsx` plus the `.nrc-*` rule
  block at the end of `app/admin-list-view.css` — see `design_handoff_nrc_field/README.md` for
  the original design spec (layout, tokens, interactions) this was built from.

## Common errors

- **"Invalid NRC format — expected e.g. 12/ABC(N)123456 or the Myanmar script equivalent"**: the
  assembled `state/township(type)number` string doesn't match `lib/nrc.ts`'s `NRC_REGEX`. Usually
  means the number field has fewer than 6 digits (the preview strip's status pill already flags
  this as "Incomplete" before you submit).
- **"This NRC number is already registered to another account."** (409): the DB unique constraint
  `user_nrc_unique` rejected the value — someone else already has that exact NRC. Handled in
  `createUserAction`/`updateUserAction` (admin), `updatePortalProfileAction` (seller portal), and
  both mobile routes (`app/api/mobile/register`, `app/api/mobile/profile`).
- **Township search shows "No township code matches that search inside this state"**: the query
  is scoped to the currently-selected state only — switch state first if the township you're
  looking for belongs to a different one.
