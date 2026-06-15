# Portal Role — Technical Notes

## What changed

Added a fourth user role `"portal"` for premium dealers who manage their own products via the web portal. Changes touch the role enum, subscription lifecycle, a new portal section at `/portal/`, and the admin users UI.

### Files modified

| File | Change |
|---|---|
| `drizzle/schema/userRole.ts` | Added `"portal"` to `userRoles` array |
| `permissions/userRole.ts` | Exported `portal` role (same AC statements as `user`) |
| `features/points/db/points.ts` | `activatePremiumDealer`, `processAutoRenewals`, `deactivatePremiumDealerSubscription` — role lifecycle |
| `lib/api-guard.ts` | Added `requirePortalRole()` guard |
| `features/users/db/users.ts` | Added `portals` to `ViewCounts`, SQL query, return, and `viewCondition` switch |
| `features/users/components/UserForm.tsx` | Added `portal` to `ROLES` constant |
| `features/users/components/UsersTable.tsx` | Added `portals` to `VIEW_IDS` and `VIEW_LABELS` |

### Files created

| File | Purpose |
|---|---|
| `app/portal/layout.tsx` | Portal shell — validates `role === "portal"`, redirects others |
| `app/portal/page.tsx` | Redirects to `/portal/products` |
| `app/portal/products/page.tsx` | Paginated list of portal user's own products |
| `app/portal/products/new/page.tsx` | Create product page |
| `app/portal/products/[id]/edit/page.tsx` | Edit product page (ownership enforced) |
| `features/products/actions/portal-products.ts` | Server actions: create, update, delete (portal-scoped) |
| `components/portal/PortalNavbar.tsx` | Header with sign-out for portal layout |
| `components/portal/PortalProductForm.tsx` | Shared create/edit form (client component) |
| `components/portal/PortalProductActions.tsx` | Edit/delete row actions (client component) |

## Data flow

```
Admin activates subscription
  → activatePremiumDealer() sets user.role = "portal"
  → user logs in → portal layout allows access → /portal/products

Portal user creates product
  → POST /api/portal/products
  → requirePortalRole() validates session
  → admin-only fields stripped (isFeatured, isCollectorPiece, etc.)
  → moderationStatus forced to "pending"
  → createProductInDb({ sellerId: session.user.id, ... })
  → product appears in admin review queue

Subscription expires (cron) or is cancelled (admin)
  → processAutoRenewals() / deactivatePremiumDealerSubscription()
  → user.role = "user"
  → portal layout redirects user to "/"
```

## Schema impact

Migration required: `ALTER TYPE user_role ADD VALUE 'portal'`

No new tables. Existing `user.role` column (text) and `user_role` enum gain the new value.

## Auth & permissions

- Portal routes under `/portal/*` — protected by `app/portal/layout.tsx` server component redirect
- Server actions — protected by `requireActionRole((role) => role === "portal")` in `lib/action-guard.ts`
- Ownership enforced in each action: `sellerId !== session.user.id` → `{ ok: false, error: "Forbidden" }`
- Admin-only product fields are stripped before Zod validation in every action

## Edge cases & known limitations

- Portal users cannot upload images directly — they paste Supabase URLs into the image URL fields (same pattern as the mobile app)
- If a portal user's subscription is renewed (auto-renew cron), `role: "portal"` is re-written to confirm it's correct
- The portal edit page uses `notFound()` for both missing products and ownership mismatches to avoid leaking IDs
- `canAdminManageProducts()` does not include `"portal"` — portal users cannot access admin product routes
