# Admin Sidebar: Configuration Sub-Menu — Design

**Date:** 2026-07-05
**Status:** Approved (amended same day: sub-menu defaults to collapsed and is
always user-collapsible; Seller Rating Tags and Precaution Tags moved from the
Settings group into Configuration)

## Goal

Add a **Configuration** main menu item to the admin sidebar with three sub-menu
items — **Category**, **Laboratory**, **Origin** — replacing their current flat
placement in the "Master Data" group.

## Design

### Structure

`components/admin/AdminSidebar.tsx` is the only component touched. The
"Master Data" group becomes:

```
MASTER DATA ─────────────── ⌄
  📦 Products
  ⚙️ Configuration          ⌄
      🗂 Category            → /admin/categories
      🧪 Laboratory          → /admin/laboratory
      🌐 Origin              → /admin/origin
```

A new `NavSubMenu` type (`{ label, icon, color, children: NavItem[] }`) is
added to the nav data model; `NavGroup.items` becomes
`(NavItem | NavSubMenu)[]`.

### Behavior

- Clicking **Configuration** toggles the sub-menu open/closed; it is a button,
  not a link.
- Sub-items keep their existing routes, icons, colors, and permission rules:
  Category is `adminOnly`; Laboratory and Origin use their RBAC feature keys.
- If the current user can see none of the three children, the Configuration
  item is hidden entirely.
- The sub-menu is **held open** while the current route is one of its children
  (you cannot collapse the menu you are inside); the parent row shows active
  text color when a child route is active.
- Open/closed state persists via the existing localStorage collapse store
  (`admin-sidebar-collapsed-groups`) under the key `submenu:Configuration`.
- The mobile drawer (`AdminSidebarSheet`) reuses the same component, so it
  inherits the behavior with no changes.

### Out of scope

No route, schema, API, or RBAC changes. Existing pages are reused as-is.

## Testing

Component tests (jsdom) in `tests/component/admin-sidebar-configuration.test.tsx`:

1. Admin sees Configuration with all three sub-links and correct hrefs.
2. Non-admin with no permissions sees no Configuration item.
3. Non-admin with only the `laboratory` feature key sees Configuration with
   only the Laboratory link.
4. Clicking Configuration collapses and re-expands the sub-menu.
5. The sub-menu stays open while a child route is active, even after a
   collapse attempt.
