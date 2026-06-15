# Portal Role — Collaborator Guide

## Overview

The `portal` role gives a premium dealer access to `/portal/` — a dedicated section where they can create and manage their own product listings. Products submitted through the portal start with `moderationStatus: "pending"` and require admin approval before going live.

## Prerequisites

- `DATABASE_URL` pointing to a Postgres instance with the `portal` enum value applied
- Run `npm run db:generate` then `npm run db:migrate` after pulling this change

## Activating a portal user

1. In the admin panel, go to **Credit → Premium Dealer Subscriptions**
2. Find the user and click **Activate subscription** (or use the point-purchase flow)
3. `activatePremiumDealer()` runs and sets `user.role = "portal"` automatically
4. The user can now log in and access `/portal/`

Alternatively, an admin can manually set a user's role to `"portal"` from **Users → [user] → Edit → Role**.

## What portal users can do

- Create product listings (loose stone or jewellery)
- Edit their own products
- Delete their own products
- View the moderation status of each listing

Portal users **cannot**:
- Access the admin panel
- Set featured/collector/privilege-assist/promotion flags
- Change moderation status
- See or edit other users' products

## When a subscription expires

The daily cron job at `/api/cron/renew-premium-dealers` runs `processAutoRenewals()`:
- Auto-renew success → role stays `"portal"`
- Auto-renew fails (insufficient points) → role reverts to `"user"`
- No auto-renew → role reverts to `"user"`

Manual cancellation via **Credit → Premium Dealer Subscriptions → Cancel** also reverts the role immediately via `deactivatePremiumDealerSubscription()`.

## Extending the portal

### Adding a new portal page

1. Create `app/portal/<section>/page.tsx` as a server component — the layout already enforces `role === "portal"`
2. Add a nav link to `components/portal/PortalNavbar.tsx`

### Adding a new portal server action

1. Add to `features/products/actions/portal-products.ts` (or create a new actions file under the relevant feature)
2. Call `requireActionRole((role) => role === "portal")` first
3. Always verify ownership before mutating data

```ts
"use server"
export async function myPortalAction(id: string) {
  const session = await requireActionRole((role) => role === "portal")
  if (!session) return { ok: false, error: "Unauthorized" }
  // session.user.id is the portal user's ID
}
```

### Adding a field portal users can edit

Add the field to `PortalProductForm.tsx` (client component) and ensure the portal API routes (`app/api/portal/products/`) don't strip it.

### Adding a field only admins should control

Keep it out of `PortalProductForm.tsx` and explicitly set it to `undefined` in the portal API routes' normalization step (see the `isFeatured: undefined` pattern in `app/api/portal/products/route.ts`).

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `403 Forbidden` on portal API | User's role is not `"portal"` | Check that the premium dealer subscription is active |
| `notFound()` on edit page | Product doesn't exist or `sellerId` mismatch | Verify the product ID belongs to the logged-in user |
| `ALTER TYPE ... cannot run inside a transaction block` | Drizzle wraps migration in a transaction | Apply the migration manually: `ALTER TYPE user_role ADD VALUE 'portal';` |
