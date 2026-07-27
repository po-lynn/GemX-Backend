# Social sign-in (mobile)

## What changed

- `app/api/mobile/google-login/route.ts` **removed**, replaced by `app/api/mobile/social-login/route.ts` — generic over `provider` (allow-list `["google"]` today; unsupported values return 400 before any better-auth call). Facebook is not wired: its native SDK returns an `accessToken`, not an ID token, so it needs a different request shape and its own verified `signInSocial` call before joining the allow-list.
- The new route also accepts the same Screen-1 profile fields `register` collects (`name`, `country`, `state`, `city`, `address`, `gender`, `dateOfBirth`, `nrc`, `nrcFrontUrl`, `nrcBackUrl`, `selfieUrl`, `businessLicenseUrl`), written via one Drizzle `update` **only when the sign-in creates a brand-new user** — a returning login never has these fields touched.
- `lib/nrc.ts` — `NRC_REGEX` now accepts the Myanmar-script NRC format (e.g. `၉/မလန(နိုင်)၁၂၈၂၃၃`) alongside the existing Latin transliteration (`12/ABC(N)123456`); `parseNrc` handles both.
- `app/api/mobile/profile/route.ts` — `profileUpdateSchema` gained `name`, `gender`, `dateOfBirth`; `nrc` is now a plain `z.string()` with a `superRefine` that only enforces `validateNrc()` when `country` is Myanmar or unset, so non-Myanmar users can store a passport/national ID there instead.
- `tests/api/mobile/google-login.test.ts` → `tests/api/mobile/social-login.test.ts` (renamed, extended); `tests/api/mobile/profile.test.ts` extended; `tests/unit/nrc.test.ts` added.
- `docs/api/mobile-google-login.md` → `docs/api/mobile-social-login.md`; `docs/guides/google-social-login.md` → `docs/guides/social-login.md`; `docs/MOBILE-API.md` updated.

## Why

Myanmar users register via phone + password (`POST /api/mobile/register`, unchanged). Non-Myanmar users don't have a Myanmar-format phone number to register with, so they sign up via a social provider instead — but they still need to fill in the same profile fields (name, address, region, gender, DOB, a passport/national ID) that Myanmar users provide on the same signup screen. Rather than a second round trip (`social-login` then `PATCH /profile`), the client sends everything in one call, matching the single-screen-then-optional-phone-screen flow the mobile app already implements.

## Data flow

1. Mobile app collects Screen-1 fields (name, country, state, city, address, NRC-or-passport-ID, DOB, gender, optional ID upload) regardless of country. If `country` is Myanmar, the client proceeds to a phone+password screen and calls `register`, unchanged. Otherwise, it shows a "Continue with Google" button.
2. On tap: native Google Sign-In produces an `idToken`. Client calls `POST /api/mobile/social-login` with `{ provider: "google", idToken, ...Screen-1 fields, ...device fields }`.
3. Route validates `provider` against the allow-list, then `nrc` against `validateNrc()` (only if `country` is Myanmar/unset) — both before touching better-auth.
4. Decodes (does not verify) the token's `email` claim locally to check `existedBefore`, purely to decide new-vs-existing for points/notification purposes — no security role.
5. `auth.api.signInSocial({ body: { provider, idToken: { token } } })` does the real verification (signature, issuer, audience, max age) and creates or links the `user` row.
6. If `isNewUser` (`!existedBefore`): credits the registration bonus, then writes any provided profile fields via one `db.update(userTable).set(...).where(eq(userTable.id, userId))` — same DB-write pattern `register` already uses for the KYC URL fields it can't pass through `signUpEmail`'s `additionalFields`.
7. NRC-uniqueness violations on that update return 409 directly (not swallowed by the route's generic 401 catch, since sign-in already succeeded at that point — only the secondary profile write failed).
8. Response mirrors `/api/mobile/login`: `{ redirect: false, token, user }`, 200 for login / 201 for signup.

## Schema impact

None — no migration. Uses the existing `user` table's already-nullable columns (`name` is `notNull()`, but only ever set to a non-empty string here, never `null`).

## Auth & permissions

Public endpoint (no bearer token in) — it *creates* a session/bearer token, like `/api/mobile/login` and `/api/mobile/register`.

## Edge cases & known limitations

- **New-vs-existing detection is a pre-check, not atomic** — same known race as the old `google-login` route: a double-submit of two simultaneous first-time sign-ins with the same email could both see "no existing row" and both credit points (`creditDefaultRegistrationPointsToUser` is not idempotent).
- **Profile fields are signup-only.** If a client sends profile fields on a login call (existing user), they are silently ignored — this is intentional, not a bug, to prevent a stale cached form from overwriting a real profile. Editing an existing user's profile must go through `PATCH /api/mobile/profile`.
- **A failed profile write does not roll back the sign-in.** If `signInSocial` succeeds but the subsequent `db.update` throws (e.g. an NRC uniqueness conflict), the user account and session already exist — the client gets a 409/500 but must retry the profile fields via `PATCH /api/mobile/profile` rather than resubmitting `social-login`.
- **`name` from the client vs. Google's own claim:** Google's `signInSocial` already sets `user.name` from the ID token. If the client also sends `name` (e.g. the user edited it on the signup form), it overwrites Google's value in the same request — last-write-wins, no conflict detection.
- **Facebook is not supported.** `isSupportedProvider` only allows `"google"`; sending `"facebook"` (or anything else) returns 400 before any external call. See `docs/guides/social-login.md` for what's needed to add it.
