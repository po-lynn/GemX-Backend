# Admin Sidebar: Configuration Sub-Menu

**Date:** 2026-07-05

## What changed

The admin sidebar's "Master Data" group previously listed Products, Categories,
Laboratory, and Origin as flat links, and the "Settings" group held Seller
Rating Tags and Precaution Tags. Five items now live under an expandable
**Configuration** parent directly below Products: **Category**,
**Laboratory**, **Origin**, **Seller Rating Tags**, and **Precaution Tags**.
The Settings group keeps only Point Packages and Settings.

Files touched:

- `components/admin/AdminSidebar.tsx` — new `NavSubMenu` type, nav data
  restructure, `renderSubMenu()` renderer, visibility filtering for nested
  items.
- `tests/component/admin-sidebar-configuration.test.tsx` — new component tests.

No routes, pages, schema, or API code changed. `AdminSidebarSheet` (mobile
drawer) reuses `AdminSidebar` and needed no changes.

## Data flow

```
navGroups (static data)            AdminSidebar render
────────────────────────           ─────────────────────────────────────────
NavGroup "Master Data"        →    group items filtered by canSee()
  ├─ NavItem Products              (a NavSubMenu is visible when ANY child
  └─ NavSubMenu Configuration       passes canSee)
       ├─ Category            →    renderSubMenu(sub, visibleChildren)
       ├─ Laboratory                ├─ toggle button (aria-expanded)
       ├─ Origin                    └─ children via renderNavLink()
       ├─ Seller Rating Tags
       └─ Precaution Tags
```

- `NavSubMenu = { label, icon, color, children: NavItem[] }`;
  `NavGroup.items` is now `(NavItem | NavSubMenu)[]`. The two are
  discriminated with a `"children" in item` check.
- Open/closed state reuses the existing module-level localStorage mini-store
  (`admin-sidebar-collapsed-groups`, via `useSyncExternalStore`). Sub-menus
  store under a prefixed key — `submenu:Configuration` — so they can never
  collide with a group label. **Semantics are inverted vs groups:** for
  sub-menu keys, presence in the store means *open*, so sub-menus **default
  to collapsed** (groups default to expanded).
- The sub-menu is always user-collapsible, including while a child route is
  active. When a child route is active, the parent row shows the active
  text/icon color (even while collapsed) so context isn't lost.

## Auth & permissions

Unchanged, moved verbatim onto the children:

- Category → `adminOnly: true` (admin role only, not feature-gated)
- Laboratory → `FEATURE_KEYS.LABORATORY`
- Origin → `FEATURE_KEYS.ORIGIN`
- Seller Rating Tags → `FEATURE_KEYS.SETTINGS_RATING_TAGS`
- Precaution Tags → `FEATURE_KEYS.SETTINGS_PRECAUTION_TAGS`

If `canSee()` rejects all three children, the Configuration item does not
render at all. The parent itself carries no permission — it derives visibility
purely from its children.

## Edge cases & known limitations

- Collapsing the enclosing "Master Data" group hides the sub-menu regardless
  of its own open state (nesting order wins).
- Navigating to a child page does not auto-expand a collapsed sub-menu; the
  highlighted parent row is the indicator that you're inside it.
- Sub-menu state shares the same localStorage array as group collapse state;
  clearing `admin-sidebar-collapsed-groups` resets both.
- Seller Rating Tags and Precaution Tags keep their `/admin/settings/...`
  routes; only their sidebar placement moved.
- Only one sub-menu exists today; the renderer is generic and supports more.
