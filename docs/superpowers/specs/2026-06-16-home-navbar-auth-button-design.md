# Home Navbar Auth Button — Design Spec

**Date:** 2026-06-16  
**Status:** Approved

## Problem

The `HomeNavbar` always shows a static "Sign in" button regardless of whether the user is already logged in. Admin, internal, and portal users who visit the home page see no path back to their respective dashboards.

## Goal

Replace the static "Sign in" button with a session-aware button that routes each role to their correct destination.

## Behavior

| Session state | Button label | Destination |
|---|---|---|
| Loading (hydrating) | Skeleton pulse | — |
| Not logged in | Sign in | `/login` |
| `role === "user"` (portal) | My Account | `/portal` |
| `role === "admin"` or `role === "internal"` | Dashboard | `/admin` |

## Architecture

`HomeNavbar` stays a server component. The auth-aware part is extracted into a small `"use client"` component that uses `authClient.useSession()`.

### Components

**`components/home/HomeNavbarAuthButton.tsx`** — new client component
- `"use client"` directive
- Uses `authClient.useSession()` from `@/lib/auth-client`
- Uses `useSyncExternalStore` for SSR-safe mount detection (same pattern as `AdminNavbarClient.tsx`)
- Renders a skeleton while mounting/loading, then the correct button based on role

**`components/home/HomeNavbar.tsx`** — existing server component
- Replace the `<Button size="sm" asChild><Link href="/login">Sign in</Link></Button>` with `<HomeNavbarAuthButton />`

### Loading / skeleton

While `!mounted || (!session && !error)`, render a skeleton matching the button dimensions (`h-9 w-24 rounded-md bg-muted animate-pulse`). This prevents layout shift.

## Data flow

```
HomeNavbar (server)
  └── HomeNavbarAuthButton (client)
        └── authClient.useSession() → { data: session, error }
              ├── loading  → <skeleton>
              ├── no session → <Button>Sign in → /login</Button>
              ├── role=user  → <Button>My Account → /portal</Button>
              └── role=admin|internal → <Button>Dashboard → /admin</Button>
```

## Files touched

| File | Change |
|---|---|
| `components/home/HomeNavbarAuthButton.tsx` | Create — client component |
| `components/home/HomeNavbar.tsx` | Replace Sign in button with `<HomeNavbarAuthButton />` |

## Out of scope

- No sign-out from home page
- No user avatar or name display
- No redirect if logged-in user tries to access home page (they can still browse it)
