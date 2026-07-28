# NRC validation: accept a bare Latin citizen-type letter in a Myanmar-script NRC

**Date:** 2026-07-28

## What changed

- `lib/nrc.ts` — `NRC_MYANMAR_SOURCE` regex and the `myanmarMatch` regex in
  `parseNrc()` now accept the citizenship-type token as *either* the
  spelled-out Myanmar word (e.g. `နိုင်`) *or* the bare Latin letter (`N`/`P`/`T`/`E`),
  while state, township, and serial stay Myanmar script/digits.
- `tests/unit/nrc.test.ts` — added regression tests for `validateNrc` and `parseNrc`
  accepting/rejecting this mixed form.

## Root cause / motivation

Reported via `POST /api/mobile/register` with:

```json
{ "nrc": "၉/မလန(N)၁၂၈၂၃၃" }
```

which returned `400 Invalid NRC format`. Before this change, `NRC_REGEX`
([lib/nrc.ts:6-11](../../lib/nrc.ts)) only accepted two fully-consistent forms:

- **All-Latin:** `12/ABC(N)123456`
- **All-Myanmar-script:** `၉/မလန(နိုင်)၁၂၈၂၃၃` — citizen type spelled out in Myanmar.

The reported input mixes Myanmar-script state/township/serial with a bare Latin
citizen-type letter — a real-world-common pattern since NRC entry UIs and printed
cards often present citizenship type as the standard `N/P/T/E` abbreviation even
on an otherwise Myanmar-script NRC. Neither existing branch matched it, so it was
rejected as invalid even though it is a legitimate NRC.

This is a narrower relaxation than "accept any mixed script" — the existing test
`rejects mixing Latin digits with Myanmar script` (state/serial digits mixed with
Myanmar township) still fails, and continues to. Only the citizen-type token gets
the extra alternation.

## Data flow

`POST /api/mobile/register` and `PATCH /api/mobile/profile` both call
`validateNrc()` ([lib/nrc.ts:27](../../lib/nrc.ts)) before writing the NRC string
to the `user.nrc` column — no schema/DB change, this is pure input validation.
`parseNrc()` is used wherever the NRC needs to be decomposed (e.g. admin views);
its Myanmar-script branch now also recognizes the Latin letter form and returns
it verbatim as `type` (not normalized to the Myanmar word).

## Auth & permissions

Unchanged — same auth context as before (public for register, bearer token for
profile).

## Edge cases & known limitations

- `parseNrc()`'s returned `type` field is `"N"` (not normalized to `"Naing"` or
  the Myanmar word) when the input used the Latin letter — callers that expect a
  full Myanmar word from Myanmar-script NRCs should not assume normalization.
- Still rejected: mixing Latin digits/township with a Myanmar citizen-type word
  (unchanged, existing behavior), and any township/serial with the wrong digit
  system.
