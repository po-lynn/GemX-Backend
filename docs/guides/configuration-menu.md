# Guide: The Configuration Sub-Menu (and adding your own)

The admin sidebar (`components/admin/AdminSidebar.tsx`) supports nested
sub-menus. **Configuration** (under Master Data) is the first one — it groups
Category, Laboratory, Origin, Seller Rating Tags, and Precaution Tags.

## Prerequisites

None beyond a running dev environment (`npm run dev`). No env vars, no
migrations.

## How it works for users

- Click **Configuration** in the sidebar to expand/collapse its links. It
  starts **collapsed** by default; the open/closed choice is remembered per
  browser (localStorage).
- While you are on one of its child pages, the Configuration row is
  highlighted (even when collapsed).
- Users only see the children they're allowed to: Category is admin-only;
  the rest follow their RBAC feature keys. Users who can see no children
  never see Configuration.

## Adding a new item under Configuration

Add a `NavItem` to the `children` array of the Configuration entry in
`navGroups`:

```tsx
{
  label: "Configuration",
  icon: SlidersHorizontal,
  color: "#6366f1",
  children: [
    // ...existing items...
    { href: "/admin/shapes", label: "Shape", icon: Shapes, color: "#f97316", featureKey: FEATURE_KEYS.SHAPES },
  ],
},
```

Permission rules are per-child: use `adminOnly: true` for admin-role-only
items or `featureKey` for RBAC-gated items (add the key in
`features/rbac/feature-keys.ts` first).

## Adding a whole new sub-menu

Insert a `NavSubMenu` object (`{ label, icon, color, children }`) anywhere in
a group's `items` array. Rendering, collapse persistence
(`submenu:<label>` key), active-route forcing, and permission filtering all
come for free. No parent-level permission exists — visibility is derived from
the children.

## Common errors

- **Sub-menu doesn't show up** — every child failed `canSee()`. Check the
  user's role/permissions and the child `featureKey`/`adminOnly` flags.
- **State seems stuck** — clear the `admin-sidebar-collapsed-groups`
  localStorage key.

## Tests

`tests/component/admin-sidebar-configuration.test.tsx` covers the collapsed
default, rendering, permission filtering, and toggling. Run with
`npm run test:component`.
