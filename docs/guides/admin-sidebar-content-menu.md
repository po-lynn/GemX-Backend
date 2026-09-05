# Admin Content menu (sidebar)

## Prerequisites

None beyond a normal admin session (`npm run dev`, signed-in admin/internal user).

## How to use

1. Open the admin panel sidebar.
2. Under **Content**, you should see **News & Articles** only (no separate News link).
3. Create/edit entries and set **Type** to News or Articles on the form.

## How to extend

To add another Content nav item, edit `navGroups` in `components/admin/AdminSidebar.tsx` and append to the Content group's `items` array (same shape as News & Articles: `href`, `label`, `icon`, `color`, `featureKey`).

To restore a separate News link, re-add:

```ts
{ href: "/admin/news", label: "News", icon: Newspaper, color: "#22c55e", featureKey: FEATURE_KEYS.NEWS },
```

and import `Newspaper` from `lucide-react`.

## Common errors

- **News pages 404 / forbidden:** unrelated to this menu change; check route files under `app/admin/news/` and `FEATURE_KEYS.NEWS` permissions.
- **News & Articles missing:** ensure `FEATURE_KEYS.ARTICLES` is granted for non-admin roles.
