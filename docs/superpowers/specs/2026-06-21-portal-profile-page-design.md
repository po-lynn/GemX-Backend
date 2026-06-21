# Portal User Profile Page — Design Spec

**Date:** 2026-06-21  
**Status:** Approved

## Overview

Replace the `/portal` homepage redirect with an editable user profile page. Portal users can view and update all their personal details (name, photo, phone, gender, DOB, NRC, address, city, state, country). A read-only sidebar shows email, points, verification status, and member since date.

---

## Route

`/portal` (currently redirects to `/portal/products`) becomes the profile page.  
`/portal/products` remains unchanged.

---

## Layout

Two-column layout matching existing portal product form pattern:
- **Main (2/3 width):** editable form fields + profile photo upload
- **Sidebar (1/3 width):** read-only account info card
- **Sticky save bar:** appears only when the form is dirty; hidden otherwise

---

## Editable Fields

| Field | Type | Validation |
|---|---|---|
| Profile photo | Image upload → URL | optional, max 5MB, jpg/png/webp/gif |
| Name | text | required, max 200 |
| Phone | text | optional, max 50 |
| Gender | select | optional: male/female/other/prefer_not_to_say |
| Date of birth | date picker | optional |
| NRC | text | optional, max 100 |
| Address | textarea | optional, max 500 |
| City | text | optional, max 100 |
| State | text | optional, max 100 |
| Country | select | optional: Myanmar/Thailand/South Korea |

---

## Read-Only Sidebar Fields

- Email address
- Points balance (with "pts" label)
- Verified status (badge)
- Member since (formatted date)

---

## Data Flow

1. `app/portal/page.tsx` (server component):
   - Gets session via `auth.api.getSession()`
   - Fetches user via `getUserById(session.user.id)`
   - Renders `<PortalProfileForm user={userForEdit} />`

2. `components/portal/PortalProfileForm.tsx` (client component):
   - Controlled form with dirty state detection
   - Profile photo: uploads to `POST /api/profile/image`, stores returned URL in state
   - Save: calls `updatePortalProfileAction(formData)` via form action
   - Shows toast/inline error on failure

3. `features/users/actions/portal-profile.ts` (server action):
   - Reads session — must be authenticated and `role === "portal"`
   - Validates with `portalProfileUpdateSchema`
   - Calls `updateUserInDb(session.user.id, data)` (same DB helper used by admin)
   - Calls `revalidatePath("/portal")`
   - Returns `{ success: true }` or `{ error: string }`

4. `features/users/schemas/portal-profile.ts`:
   - All editable fields optional except name (required)
   - Mirrors subset of `userUpdateSchema` but without admin-only fields (role, points, verified, archived, userId)

---

## Navbar Update

`PortalNavbar` gains two nav links:
- **Profile** → `/portal`
- **Products** → `/portal/products`

Active link highlighted. Points badge and sign-out button remain on the right.

---

## New Files

| File | Purpose |
|---|---|
| `components/portal/PortalProfileForm.tsx` | Client form component |
| `features/users/actions/portal-profile.ts` | Self-update server action |
| `features/users/schemas/portal-profile.ts` | Zod validation schema |

## Modified Files

| File | Change |
|---|---|
| `app/portal/page.tsx` | Replace redirect with server component fetching + rendering profile form |
| `components/portal/PortalNavbar.tsx` | Add Products + Profile nav links |

---

## Security

- Server action reads its own session — users can only update their own record
- `role === "portal"` enforced in action (portal layout already guards the route but action must be self-contained)
- No admin-only fields (role, points, verified, archived) are in the portal schema or action

---

## Out of Scope

- Password change (separate feature)
- Email change (requires re-verification flow)
- Username / displayUsername (admin-managed)
- KYC / document upload
