# Admin Motion & Skeleton System Design

**Date:** 2026-06-13  
**Status:** Approved  
**Scope:** All admin routes under `app/admin/`

---

## Overview

Add Motion (motion.dev) spring animations and content-aware colour-tinted shimmer skeletons to the entire GemX admin panel. The existing white/grey visual design stays unchanged — Motion adds life through physics-based motion, not visual redesign.

---

## Decisions

| Dimension | Choice |
|-----------|--------|
| Animation style | Spring Motion — clean white design stays, everything moves |
| Skeleton animation | Colour-tinted shimmer (accent colour per page) |
| Skeleton shapes | 5 content-aware types |
| Accent colours | Inherited from existing sidebar nav `color` fields |
| Animation scope | Entrance + hover interactions + page transitions |
| Spring personality | Moderate iOS (stiffness 200, damping 20) |
| Architecture | Per-route `loading.tsx` + shared motion primitive library |
| Page transitions | `app/admin/template.tsx` with AnimatePresence, entrance-only |

---

## Architecture

### New files

```
lib/
  motion-spring.ts                      ← spring presets + variants

components/admin/motion/
  index.ts                              ← re-exports
  fade-up.tsx                           ← FadeUp entrance wrapper
  stagger-list.tsx                      ← StaggerList container
  hover-card.tsx                        ← HoverCard (lift + shadow on hover)
  press-button.tsx                      ← PressButton (scale on tap)
  skeleton/
    sk-block.tsx                        ← generic shimmer block
    sk-card.tsx                         ← stat card skeleton
    sk-row.tsx                          ← table row skeleton
    sk-form-field.tsx                   ← label + input skeleton pair

app/admin/
  template.tsx                          ← page transition wrapper
  loading.tsx                           ← dashboard skeleton
  products/loading.tsx
  categories/loading.tsx
  users/loading.tsx
  users/[id]/products/loading.tsx
  laboratory/loading.tsx
  origin/loading.tsx
  news/loading.tsx
  articles/loading.tsx
  messages/loading.tsx
  chat-dashboard/loading.tsx
  collector-piece-show-requests/loading.tsx
  credit/loading.tsx
  credit/purchase-requests/loading.tsx
  credit/premium-dealer-subscriptions/loading.tsx
  credit/transactions/loading.tsx
  settings/escrow-service/loading.tsx
  settings/rating-tags/loading.tsx
  # Form routes (shape 3) — 14 routes:
  products/new/loading.tsx
  products/[id]/edit/loading.tsx
  categories/new/loading.tsx
  categories/[id]/edit/loading.tsx
  laboratory/new/loading.tsx
  laboratory/[id]/edit/loading.tsx
  origin/new/loading.tsx
  origin/[id]/edit/loading.tsx
  news/new/loading.tsx
  news/[id]/edit/loading.tsx
  articles/new/loading.tsx
  articles/[id]/edit/loading.tsx
  messages/new/loading.tsx
  messages/[id]/edit/loading.tsx
  users/new/loading.tsx
  users/[id]/edit/loading.tsx   ← already exists, replace with SkFormField version
  settings/rating-tags/new/loading.tsx
  settings/rating-tags/[id]/edit/loading.tsx
```

### Modified files

- `app/globals.css` — add `@keyframes sk-shimmer` + `.sk-shimmer` class
- `app/admin/page.tsx` — wrap sections with StaggerList / FadeUp
- `app/admin/products/page.tsx` — StaggerList on results
- All other list pages — StaggerList on results container
- All form pages — FadeUp on form card
- `app/admin/layout.tsx` — remove existing `animate-pulse` fallback (replaced by per-route loading.tsx)
- `package.json` — add `motion` dependency

---

## Spring Config (`lib/motion-spring.ts`)

```ts
export const springs = {
  entrance: { type: "spring", stiffness: 200, damping: 20, mass: 1 },
  hover:    { type: "spring", stiffness: 300, damping: 25 },
  press:    { type: "spring", stiffness: 400, damping: 30 },
  page:     { type: "spring", stiffness: 180, damping: 22 },
} as const

export const variants = {
  fadeUp: {
    hidden:  { opacity: 0, y: 14, scale: 0.97 },
    visible: { opacity: 1, y: 0,  scale: 1 },
  },
  stagger: {
    hidden:  {},
    visible: { transition: { staggerChildren: 0.07 } },
  },
}
```

---

## Motion Primitives

### FadeUp
Wraps any content with the entrance animation. Optional `delay` prop for manual offset when not inside a StaggerList.

```tsx
<FadeUp delay={0.1}><StatCard /></FadeUp>
```

### StaggerList
Container using `variants.stagger`. Direct `motion.div` children inherit stagger timing automatically.

```tsx
<StaggerList className="grid grid-cols-4 gap-4">
  <motion.div variants={variants.fadeUp}><StatCard /></motion.div>
</StaggerList>
```

### HoverCard
Wraps a card element. On hover: `y: -2`, shadow deepens. On tap: `scale: 0.98`. Spring-driven via `springs.hover`.

### PressButton
Wraps a `<button>` or shadcn `<Button>`. `whileTap: { scale: 0.97 }` via `springs.press`. Does not replace the button — composable wrapper.

### PageTransition (`app/admin/template.tsx`)
```tsx
"use client"
export default function AdminTemplate({ children }) {
  const pathname = usePathname()
  return (
    <AnimatePresence mode="sync">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springs.page}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
```

No exit animation. Next.js App Router unmounts template immediately on navigation — exit animations would block the route change and feel janky with server-streamed content.

---

## Skeleton System

### Base shimmer (globals.css)

```css
@keyframes sk-shimmer {
  0%   { background-position: -600px 0; }
  100% { background-position:  600px 0; }
}
.sk-shimmer {
  background-size: 1200px 100%;
  animation: sk-shimmer 1.6s linear infinite;
}
```

### SkBlock

Generic primitive. All other skeleton components are built from it.

```tsx
<SkBlock w={48} h={12} color="#8b5cf6" opacity={0.18} rounded="md" />
```

`color` accepts a hex string. Internally `SkBlock` converts hex to `r,g,b` triplet at render time (a small inline helper `hexToRgb`), then builds the gradient as:

```
linear-gradient(90deg,
  rgba(r,g,b, opacity)        25%,
  rgba(r,g,b, opacity * 1.6)  50%,   ← lighter centre = shimmer flash
  rgba(r,g,b, opacity)        75%
)
```

The gradient is set as `backgroundImage` inline so the `sk-shimmer` CSS class can drive `backgroundPosition` via animation.

### SkCard

One stat card skeleton. Takes `accentColor` prop.

```
┌─────────────────┐
│ [■■ 28×28]      │  ← icon block, accent tint
│ ■■■■■           │  ← number (40px wide)
│ ■■■■■■■■       │  ← label (64px wide, 60% opacity)
└─────────────────┘
```

### SkRow

One table row. Takes `cols` prop (default 5).

```
[●] ■■■■■■■■■■  ■■■■■■  ■■■■■■■■  [■■ pill]
```

### SkFormField

One label + input pair, stacked vertically.

```
■■■■■■           ← label (80px)
[■■■■■■■■■■■■]  ← input (full width, 38px tall)
```

---

## Skeleton Shapes by Page

### Shape 1 — Dashboard
4 `SkCard` in a grid + 6-column quick-nav grid of icon+label `SkBlock` pairs.  
Accent: violet `#8b5cf6` / blue `#3b82f6` / amber `#f59e0b` / green `#22c55e`

### Shape 2 — List view
Filter bar row of `SkBlock` + 8 `SkRow` instances. Used by:

| Page | Accent |
|------|--------|
| Products | `#3b82f6` |
| Categories | `#f59e0b` |
| Users | `#ec4899` |
| Laboratory | `#22c55e` |
| Origin | `#14b8a6` |
| News | `#22c55e` |
| Articles | `#64748b` |
| Messages | `#d946ef` |
| Purchase Requests | `#f59e0b` |
| Collector Requests | `#8b5cf6` |
| Dealer Subscriptions | `#eab308` |
| Payment Transactions | `#8b5cf6` |
| Rating Tags | `#ef4444` |
| Users › Products | `#ec4899` |

### Shape 3 — Form page
Page title `SkBlock` + 4–6 `SkFormField` pairs inside a card container. Used by all `/new` and `/[id]/edit` routes. Accent inherits from the parent feature colour.

### Shape 4 — Chat Dashboard
Left panel: 6 `SkRow`. Right panel: full-width `SkBlock` (chat area).  
Accent: `#0ea5e9`

### Shape 5 — Credit hub
3 `SkCard` in a row (package tiers).  
Accent: `#8b5cf6`

---

## Animation Placement

### HoverCard applied to
- Stat cards on the dashboard
- Quick-nav grid items on the dashboard
- Every card in list view results
- Package tier cards on the credit page

### PressButton applied to
- Primary action buttons (Save, Create, Approve, Reject)
- Filter apply/reset buttons
- Pagination buttons

### Not animated
- AdminSidebar (persists across navigations — animating it would feel wrong)
- Top navbar
- Table row text inside `ListViewTable` (too much DOM for spring physics)
- Form input focus states (handled by existing CSS)

---

## Dependency

```bash
npm install motion
```

motion.dev v11+ (`motion` package, not `framer-motion`). Import from `"motion/react"` for React components.

---

## File count estimate

- New files: ~48 (1 template + 1 spring config + 6 motion primitives + ~35 loading.tsx + 5 skeleton components)
- Modified files: ~22 (real page components + globals.css + layout.tsx + package.json)
