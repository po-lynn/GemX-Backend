# Admin sidebar — remove News under Content

## What changed

Removed the separate **News** nav item from the admin **Content** group. The Content link is now **News & Articles** (same `/admin/articles` route) with a Type field on the form — see `docs/technical/articles-content-type.md`.

**File:** `components/admin/AdminSidebar.tsx`

- Dropped `{ href: "/admin/news", label: "News", ... }` from the Content `items` array
- Removed the unused `Newspaper` lucide import
- Renamed Articles label → **News & Articles**

## Data flow

Unaffected for the legacy `/admin/news` stack. Editorial create/edit for both kinds uses `/admin/articles` + `articles.type`.

## Schema impact

None for this nav-only change. Type column is documented in `articles-content-type.md`.

## Auth & permissions

No change to RBAC. `FEATURE_KEYS.NEWS` remains defined for any remaining news pages/APIs. The sidebar no longer reads it for a Content → News link.

## Edge cases & known limitations

- Direct URLs like `/admin/news` still work if the user has access
- Dashboard quick actions (if any) that link to News are unchanged by this edit
