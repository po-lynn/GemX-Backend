# Myanmar NRC validation (`lib/nrc.ts`)

## Prerequisites

None — pure functions, no env vars or external deps.

## Accepted formats

| Form | Example | Notes |
|------|---------|-------|
| All-Latin | `12/ABC(N)123456` | State 1–14, township 3 uppercase letters, type `N`/`P`/`T`/`E`, serial 6 digits |
| All-Myanmar-script | `၉/မလန(နိုင်)၁၂၈၂၃၃` | Citizen type spelled out in Myanmar (`နိုင်`, `ပြု`, `သီ`, `ဂုဏ်`) |
| Myanmar script + Latin type letter | `၉/မလန(N)၁၂၈၂၃၃` | State/township/serial in Myanmar script/digits, citizen type as the bare Latin letter |

Any other mix (e.g. Latin digits with a Myanmar township, or a Latin NRC with a
Myanmar citizen-type word) is rejected.

## Usage

```ts
import { validateNrc, parseNrc, nrcSchema } from "@/lib/nrc";

validateNrc("၉/မလန(N)၁၂၈၂၃၃"); // true

parseNrc("၉/မလန(N)၁၂၈၂၃၃");
// { state: 9, township: "မလန", type: "N", serial: "၁၂၈၂၃၃" }
// note: `type` is returned verbatim — "N" here, not normalized to a Myanmar word

nrcSchema.safeParse(nrc); // Zod schema wrapping validateNrc, used in request bodies
```

`nrc` is only validated against this format when the caller's `country` is
Myanmar or omitted (see `app/api/mobile/register/route.ts` and
`app/api/mobile/profile/route.ts`) — any other country stores `nrc` as a
free-text passport/national ID with no format check.

## Extending

- **New citizen type letter/word:** add it to `NRC_CITIZEN_TYPES` and the
  `[NPTE]` character classes in `NRC_LATIN_SOURCE`/`NRC_MYANMAR_SOURCE`
  (`lib/nrc.ts`), and to the `myanmarMatch` regex in `parseNrc()`.
- **New accepted mixed form:** add a branch to `NRC_REGEX`'s alternation and a
  matching parse branch in `parseNrc()` — keep each branch's constraints
  explicit rather than loosening an existing branch, so invalid mixes (e.g.
  Latin digits + Myanmar township) keep failing.
- Always add both a `validateNrc` and a `parseNrc` test per new branch — see
  `tests/unit/nrc.test.ts`.

## Common errors

- `400 Invalid NRC format...` — the string doesn't match any accepted branch.
  Check which script family each token (state, township, type, serial) is in;
  a single token from the wrong family fails the whole string.
- `409 This NRC number is already registered to another account.` — NRC
  uniqueness is enforced at the DB level, independent of format validation.
