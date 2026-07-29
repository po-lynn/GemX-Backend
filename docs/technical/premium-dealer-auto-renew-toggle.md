# Premium Dealer Auto-Renew Toggle

## What changed

Previously, `autoRenew` could only be set once, at activation time (`POST /api/mobile/premium-dealers/activate`). The "Become Premium" mobile screen's already-premium state showed a "Turn off"/"Turn on" auto-renew pill, but per `docs/qa/become-premium.md` (E2E-BP-03) it was **client-side only** — tapping it never called the backend, so the daily renewal cron would keep renewing (and deducting points) regardless of what the pill displayed.

Added **PATCH `/api/mobile/premium-dealers/auto-renew`** so the toggle actually persists.

**Files touched:**
- `app/api/mobile/premium-dealers/auto-renew/route.ts` — new route, `PATCH` handler
- `features/points/db/points.ts` — new `setPremiumDealerAutoRenew(userId, autoRenew)` query helper
- `tests/api/mobile/premium-dealers-auto-renew.test.ts` — route tests
- `tests/unit/premium-dealer-auto-renew.test.ts` — db helper tests
- `docs/MOBILE-API.md` — new section **5.4.3d**, endpoint tables, changelog entry
- `docs/qa/become-premium.md` — new section **3a**, E2E-BP-03 updated to reflect the real API call

## Data flow

```
PATCH /api/mobile/premium-dealers/auto-renew  { autoRenew: boolean }
  → auth.api.getSession(request.headers)          — 401 if no session
  → bodySchema.safeParse(body)                     — 400 "Invalid input" if not { autoRenew: boolean }
  → setPremiumDealerAutoRenew(userId, autoRenew)
      → SELECT id FROM premium_dealers_packages
          WHERE user_id = :userId AND status = 'active' AND end_date > now()
          ORDER BY created_at DESC LIMIT 1
      → null if no row found                        — 400 "No active premium dealer subscription"
      → UPDATE premium_dealers_packages SET auto_renew = :autoRenew WHERE id = :id
  → { success: true, autoRenew }
```

The select-then-update (rather than a single `UPDATE ... WHERE user_id AND status='active'`) mirrors the row-selection logic already used by `getMyPremiumStatus` — if a user somehow has more than one `active` row (e.g. reactivating before the cron marks an old row expired), only the most recently created one is affected, keeping the toggle consistent with what `GET /status` and the public list report as "current".

## Schema impact

None. Reuses the existing `auto_renew` column on `premium_dealers_packages` (`drizzle/schema/points-schema.ts`) — no migration needed.

## Auth & permissions

Bearer/session auth required (`auth.api.getSession`), same as `POST /activate` and `GET /status`. No admin privileges needed — a user can only toggle their own subscription (scoped by `session.user.id`).

## Edge cases & known limitations

- If the user has no active, non-expired subscription, the endpoint returns **400** rather than silently no-oping — the mobile client should only surface the toggle when `GET /status` reports `active: true`.
- Does not touch `expiresAt`/`packageName`/points — purely flips the `auto_renew` flag on the current active row.
- The renewal cron (`app/api/cron/renew-premium-dealers/route.ts`) already reads `auto_renew` off the same row at expiry time, so no cron changes were needed — this endpoint just makes the flag it reads reflect the user's latest choice.
