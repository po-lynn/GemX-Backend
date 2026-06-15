# RBAC Access Control — Technical Reference

## Overview

The admin panel enforces role-based access control with two roles:

- **`admin`** — full access to every page, API route, and action with no restrictions.
- **`internal`** — configurable access. Each feature must be explicitly enabled for the internal role before it becomes accessible. All internal users share the same permission profile (role-wide, not per-user).

Permissions are stored in the database and cached with Next.js tag-based invalidation. When an admin toggles access, the cache is busted immediately so the next internal user request reflects the change.

---

## Data Flow

```
Admin visits /admin/permissions
  → PermissionsForm renders current on/off toggles
  → Admin submits form
  → savePermissions() Server Action (app/admin/permissions/actions.ts)
      → auth check: session.user.role must be "admin"
      → updatePermissionsSchema.safeParse() validates keys against FEATURE_KEYS enum
      → setInternalPermissions(perms) (features/rbac/db/permissions.ts)
          → INSERT ... ON CONFLICT DO UPDATE for each feature key
          → revalidateTag("internal-permissions")
  → Next internal user page request
      → requireFeatureAccess() or getInternalPermissions() called
      → unstable_cache miss (tag was invalidated) → fresh DB read
      → result cached under tag "internal-permissions"
```

---

## Key Files

| File | Purpose |
|------|---------|
| `features/rbac/feature-keys.ts` | `FEATURE_KEYS` constant (14 keys) and `FEATURE_GROUPS` array used to render the permissions UI |
| `drizzle/schema/rbac-schema.ts` | Drizzle table definition for `internal_permission` |
| `features/rbac/schemas/permissions.ts` | Zod schema (`updatePermissionsSchema`) that validates submitted permission maps against the `FEATURE_KEYS` enum |
| `features/rbac/db/permissions.ts` | `getUserPermissions()` (cached), `checkInternalAccess(key)`, `setUserPermissions(perms)` |
| `lib/admin-guard.ts` | `requireAdmin()` and `requireFeatureAccess(featureKey)` — used in Server Component pages |
| `lib/api-guard.ts` | `requireAdminOrFeature(request, featureKey)` — used in API route handlers |
| `app/admin/permissions/page.tsx` | Permissions management UI (admin-only) |
| `app/admin/permissions/actions.ts` | `savePermissions()` Server Action |
| `app/admin/permissions/PermissionsForm.tsx` | Client form component with toggle UI |
| `components/admin/AdminSidebar.tsx` | Sidebar with `canSee()` filtering; receives `role` + `permissions` props |
| `app/admin/layout.tsx` | Fetches session + internal permissions, passes to sidebar |

---

## Database Schema

```sql
CREATE TABLE internal_permission (
  feature_key TEXT PRIMARY KEY,
  can_access  BOOLEAN NOT NULL DEFAULT false
);
```

Rows are upserted (not deleted) when permissions are saved. A missing row is treated as `false` by the application.

---

## Page-Level Enforcement

Both guards live in `lib/admin-guard.ts` and are called at the top of every admin Server Component page.

### `requireAdmin()`

Allows only users with `role === "admin"`. All other outcomes redirect:

| Condition | Result |
|-----------|--------|
| No session | redirect to `/login` |
| Authenticated, role is not `admin` | redirect to `/admin` |
| role is `admin` | returns session, page renders |

**Pages using `requireAdmin()`:**
- `/admin/categories` (list, new, edit)
- `/admin/users` (list, new, edit, user-products)
- `/admin/permissions`

### `requireFeatureAccess(featureKey)`

Allows admins unconditionally; allows internal users only when the feature is enabled.

| Condition | Result |
|-----------|--------|
| No session | redirect to `/login` |
| role is `admin` | returns session immediately (no DB check) |
| role is `internal`, feature enabled | returns session |
| role is `internal`, feature disabled | redirect to `/admin` |
| any other role | redirect to `/admin` |

**Pages using `requireFeatureAccess()`:**

| Feature key | Pages guarded |
|-------------|--------------|
| `products` | `/admin/products`, `/admin/products/new`, `/admin/products/[id]/edit` |
| `credit.packages` | `/admin/credit` |
| `credit.purchase_requests` | `/admin/credit/purchase-requests` |
| `credit.subscriptions` | `/admin/credit/premium-dealer-subscriptions` |
| `credit.transactions` | `/admin/credit/transactions` |
| `news` | `/admin/news`, `/admin/news/new`, `/admin/news/[id]/edit` |
| `articles` | `/admin/articles`, `/admin/articles/new`, `/admin/articles/[id]/edit` |
| `origin` | `/admin/origin`, `/admin/origin/new`, `/admin/origin/[id]/edit` |
| `laboratory` | `/admin/laboratory`, `/admin/laboratory/new`, `/admin/laboratory/[id]/edit` |
| `messages` | `/admin/messages`, `/admin/messages/new`, `/admin/messages/[id]/edit` |
| `chat_dashboard` | `/admin/chat-dashboard` |
| `collector_requests` | `/admin/collector-piece-show-requests` |
| `settings.rating_tags` | `/admin/settings/rating-tags`, new, edit |
| `settings.escrow` | `/admin/settings/escrow-service` |

---

## API-Level Enforcement

### `requireAdminOrFeature(request, featureKey)`

Returns `{ session }` on success or `{ error: Response }` on failure. Call pattern in route handlers:

```ts
const gate = await requireAdminOrFeature(request, FEATURE_KEYS.SOME_FEATURE)
if (gate.error) return gate.error
// gate.session is now available
```

| Condition | Result |
|-----------|--------|
| No session | `401 Unauthorized` |
| role is `admin` | `{ session }` |
| role is `internal`, feature enabled | `{ session }` |
| role is `internal`, feature disabled | `403 Forbidden` |

**Routes using `requireAdminOrFeature()`:**

| Route | Feature key |
|-------|-------------|
| `GET /api/admin/chat/presence` | `chat_dashboard` |
| `GET /api/admin/collector-piece-show-requests` | `collector_requests` |
| `POST /api/admin/collector-piece-show-requests/[id]/approve` | `collector_requests` |
| `GET /api/admin/point-purchase-requests` | `credit.purchase_requests` |
| `POST /api/admin/point-purchase-requests/[id]/approve` | `credit.purchase_requests` |
| `POST /api/admin/point-purchase-requests/[id]/reject` | `credit.purchase_requests` |

**Routes with hardcoded admin-only guards (inline, not using `lib/api-guard.ts`):**

| Route | Reason |
|-------|--------|
| `GET/POST /api/admin/feature-settings` | App-wide feature flags; too sensitive to expose to internal users |
| `POST /api/admin/push/global` | Global push broadcast; admin-only by design |
| `GET /api/admin/users/suggest` | User lookup helper; tied to the admin-only users feature |

---

## Sidebar Filtering

`app/admin/layout.tsx` resolves the current session and, if the user is an internal user, fetches the full permissions map from the cached `getUserPermissions()`. Both `role` and `permissions` are passed as props to `AdminSidebar` (and `AdminSidebarSheet` for mobile).

The `canSee(item: NavItem): boolean` function inside `AdminSidebar`:

```ts
function canSee(item: NavItem): boolean {
  if (role === "admin") return true        // admins see everything
  if (item.adminOnly) return false         // blocked for all non-admins
  if (!item.featureKey) return true        // no key = visible to all (e.g. Dashboard)
  return permissions[item.featureKey] ?? false
}
```

Each `NavItem` in the nav config carries either `adminOnly: true` (permanently hidden from internal users) or a `featureKey` (visible only when that key is enabled). Items with neither flag are visible to everyone.

**Design decision — role-wide permissions:** All internal users share one permission profile. There is no per-user override mechanism. This mirrors Odoo's group-level access model and keeps permission management simple: one toggle affects all internal accounts simultaneously.

---

## Hardcoded Admin-Only Features

These features are intentionally excluded from `FEATURE_KEYS` and cannot be enabled for internal users through the permissions UI:

| Feature | Sidebar flag | Page guard | API guard |
|---------|-------------|------------|-----------|
| Categories management | `adminOnly: true` | `requireAdmin()` | n/a |
| Users management | `adminOnly: true` | `requireAdmin()` | `/api/admin/users/suggest` inline |
| Permissions management | `adminOnly: true` | `requireAdmin()` | Server Action auth check |
| Feature settings | n/a (no sidebar entry) | n/a | inline admin check |
| Global push broadcast | n/a (no sidebar entry) | n/a | inline admin check |

---

## Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Unauthenticated request to any admin page | `requireAdmin()` / `requireFeatureAccess()` → redirect `/login` |
| Authenticated but role is neither `admin` nor `internal` (e.g. `user`) | Middleware redirects to `/` before reaching any admin page |
| Internal user visits a feature page that is disabled | `requireFeatureAccess()` → redirect `/admin` (dashboard) |
| Internal user calls an API route for a disabled feature | `requireAdminOrFeature()` → `403 Forbidden` |
| Admin saves an empty permission set | `setUserPermissions` skips the upsert but still calls `revalidateTag` |
| Unknown feature key submitted to `savePermissions` | `updatePermissionsSchema.safeParse()` fails → `{ ok: false, error: "Invalid permissions data" }` |
