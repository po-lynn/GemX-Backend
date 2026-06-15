# RBAC Access Control — Collaborator Guide

This guide explains how to work with the admin panel's role-based access control system: how to add a new configurable feature, how to make a feature permanently admin-only, where to configure permissions at runtime, and how to verify your changes.

---

## Where permissions are configured

Navigate to `/admin/permissions` (admin login required). Each feature has an on/off toggle. Saving applies the change immediately — internal users see the updated sidebar and page access on their next request.

---

## How to add a new configurable feature

Follow these steps in order. All five must be completed for the feature to work correctly.

### Step 1 — Add the feature key to `FEATURE_KEYS`

`features/rbac/feature-keys.ts`

```ts
export const FEATURE_KEYS = {
  // ...existing keys...
  MY_NEW_FEATURE: "my_new_feature",
} as const
```

Use `snake_case` for the string value. Dots are used for sub-features of a group (e.g. `"credit.packages"`).

### Step 2 — Add the feature to a `FEATURE_GROUPS` group

This controls how the toggle appears in the `/admin/permissions` UI.

```ts
export const FEATURE_GROUPS = [
  // ...existing groups...
  {
    label: "My Section",
    features: [
      { key: FEATURE_KEYS.MY_NEW_FEATURE, label: "My New Feature" },
    ],
  },
]
```

Add to an existing group if the feature fits there. Only create a new group if the feature is genuinely a new category.

### Step 3 — Add `featureKey` to the sidebar NavItem

`components/admin/AdminSidebar.tsx`

```ts
{ href: "/admin/my-new-feature", label: "My New Feature", icon: SomeIcon, color: "#...", featureKey: FEATURE_KEYS.MY_NEW_FEATURE },
```

Do **not** set `adminOnly: true` — that would permanently hide it from internal users regardless of the permission toggle.

### Step 4 — Guard every page in the feature

At the top of each Server Component page (list, detail, new, edit):

```ts
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"

export default async function MyNewFeaturePage() {
  await requireFeatureAccess(FEATURE_KEYS.MY_NEW_FEATURE)
  // ...rest of page
}
```

Admins pass through unconditionally. Internal users are checked against the DB cache.

### Step 5 — Guard any API routes the feature uses

If you have API routes under `app/api/admin/` that internal users need to call:

```ts
import { requireAdminOrFeature } from "@/lib/api-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"

export async function GET(request: NextRequest) {
  const gate = await requireAdminOrFeature(request, FEATURE_KEYS.MY_NEW_FEATURE)
  if (gate.error) return gate.error
  // gate.session is available here
}
```

Apply this to every HTTP method handler on the route that internal users should be able to reach.

---

## How to make a feature permanently admin-only

Use this approach when the feature should never be configurable — it will not appear in the permissions UI at all.

**Do not add the feature to `FEATURE_KEYS` or `FEATURE_GROUPS`.**

### Sidebar

```ts
{ href: "/admin/my-admin-feature", label: "My Admin Feature", icon: SomeIcon, color: "#...", adminOnly: true },
```

`adminOnly: true` hides the item for all non-admin roles, regardless of any permission toggles.

### Page

```ts
import { requireAdmin } from "@/lib/admin-guard"

export default async function MyAdminFeaturePage() {
  await requireAdmin()
  // ...
}
```

### API routes

Either import and use a dedicated admin check or write an inline guard:

```ts
// Option A — inline (used by feature-settings and push/global routes)
async function requireAdminInline(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session || session.user.role !== "admin") {
    return { error: jsonError("Forbidden", 403), session: null }
  }
  return { error: null, session }
}
```

---

## Testing a permission change

1. Log in as an admin. Go to `/admin/permissions`.
2. Toggle the target feature off. Save.
3. Open a private/incognito window and log in as an internal account.
4. **Sidebar check:** the feature's nav item should not appear.
5. **Direct URL check:** navigate to the feature's page URL directly (e.g. `/admin/products`). You should be redirected to `/admin`.
6. **API check (if applicable):** call the feature's API route. You should receive `403 Forbidden`.
7. Go back to `/admin/permissions` as admin, toggle the feature on, save.
8. Reload the internal session. The nav item should reappear and the page should be accessible.

---

## Common mistakes

**Adding `adminOnly: true` to a configurable feature**

If you set `adminOnly: true` on a sidebar item that also has a `featureKey`, the item will never appear for internal users regardless of the permissions toggle. Remove `adminOnly` and rely solely on `featureKey`.

**Guarding only the list page but not new/edit pages**

Every page in a feature must call `requireFeatureAccess()`. An internal user with no access to Products could still reach `/admin/products/new` if that page is not guarded.

**Forgetting to add the key to `FEATURE_GROUPS`**

The feature will be fully functional but invisible in the permissions UI — admins will not be able to toggle it on or off.

**Using `requireAdmin()` instead of `requireFeatureAccess()` for a configurable feature**

`requireAdmin()` blocks internal users unconditionally. Use `requireFeatureAccess()` for features that should be toggleable.

---

## Reference: current configurable features

| Feature key | Label in UI | Pages |
|-------------|------------|-------|
| `products` | Products | `/admin/products/**` |
| `credit.packages` | Point Packages | `/admin/credit` |
| `credit.purchase_requests` | Purchase Requests | `/admin/credit/purchase-requests` |
| `credit.subscriptions` | Dealer Subscriptions | `/admin/credit/premium-dealer-subscriptions` |
| `credit.transactions` | All Transactions | `/admin/credit/transactions` |
| `news` | News | `/admin/news/**` |
| `articles` | Articles | `/admin/articles/**` |
| `origin` | Origin | `/admin/origin/**` |
| `laboratory` | Laboratory | `/admin/laboratory/**` |
| `messages` | Messages | `/admin/messages/**` |
| `chat_dashboard` | Chat Dashboard | `/admin/chat-dashboard` |
| `collector_requests` | Collector Requests | `/admin/collector-piece-show-requests` |
| `settings.rating_tags` | Seller Rating Tags | `/admin/settings/rating-tags/**` |
| `settings.escrow` | Escrow Service | `/admin/settings/escrow-service` |

## Reference: permanently admin-only features

These are not in `FEATURE_KEYS` and cannot be enabled for internal users:

- **Categories** — `adminOnly: true` in sidebar, `requireAdmin()` on all pages
- **Users** — `adminOnly: true` in sidebar, `requireAdmin()` on all pages; `/api/admin/users/suggest` inline-guarded
- **Permissions** — `adminOnly: true` in sidebar, `requireAdmin()` on page, admin check in `savePermissions` Server Action
- **Feature settings** — no sidebar entry; `/api/admin/feature-settings` inline-guarded
- **Global push broadcast** — no sidebar entry; `/api/admin/push/global` inline-guarded
