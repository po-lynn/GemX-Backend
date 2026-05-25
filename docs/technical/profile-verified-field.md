# Profile API — `verified` field

## What changed

- `app/api/profile/route.ts` — `GET` handler `profile` object includes `verified: user.verified`.
- `app/api/profile/[id]/route.ts` — public `GET` handler `profile` object includes `verified: user.verified`.
- `docs/MOBILE-API.md` — sections **5.4** and **5.4a**, recent changes, and endpoint tables updated.

## Data flow

1. `auth.api.getSession` resolves the current user id.
2. `getUserById` selects `user.verified` from Postgres (`drizzle/schema/auth-schema.ts`).
3. Route maps `verified` onto the JSON `profile` payload (alongside existing `emailVerified`).

## Schema impact

None. Uses existing `user.verified` column (`boolean`, default `false`, set by admin).

## Auth & permissions

Bearer session required. Only the authenticated user’s own `verified` value is returned.

## Edge cases

- `verified` defaults to `false` for new users until admin toggles it in the admin user form.
- Distinct from `emailVerified` (Better Auth email verification).
