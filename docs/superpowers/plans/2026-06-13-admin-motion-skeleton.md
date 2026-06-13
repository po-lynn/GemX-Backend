# Admin Motion & Skeleton System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add motion.dev spring animations and colour-tinted shimmer skeleton loading states across all admin routes.

**Architecture:** Per-route `loading.tsx` files built from shared skeleton primitives (`SkBlock`, `SkCard`, `SkRow`, `SkFormField`). Motion primitives (`FadeUp`, `StaggerList`, `HoverCard`, `PressButton`) are wired into real page components. `app/admin/template.tsx` provides page-level spring entrance on every navigation.

**Tech Stack:** motion.dev v11+ (package name `motion`, import from `"motion/react"`), React 19, Next.js 16 App Router, Vitest + jsdom for tests.

**Spec:** `docs/superpowers/specs/2026-06-13-admin-motion-skeleton-design.md`

---

## File Map

### Created
| File | Purpose |
|------|---------|
| `lib/motion-spring.ts` | Spring presets + animation variants (single source of truth) |
| `components/admin/motion/skeleton/sk-block.tsx` | Base shimmer block primitive |
| `components/admin/motion/skeleton/sk-card.tsx` | Stat card skeleton |
| `components/admin/motion/skeleton/sk-row.tsx` | Table row skeleton |
| `components/admin/motion/skeleton/sk-form-field.tsx` | Form field skeleton |
| `components/admin/motion/skeleton/index.ts` | Re-exports all skeleton primitives |
| `components/admin/motion/fade-up.tsx` | Entrance animation wrapper |
| `components/admin/motion/stagger-list.tsx` | Staggered list container |
| `components/admin/motion/hover-card.tsx` | Hover lift + tap scale |
| `components/admin/motion/press-button.tsx` | Button press scale (replaces shadcn Button) |
| `components/admin/motion/index.ts` | Re-exports all motion primitives |
| `app/admin/template.tsx` | Page transition — re-mounts on every navigation |
| `app/admin/loading.tsx` | Dashboard skeleton (Shape 1) |
| 14 × `app/admin/*/loading.tsx` | List page skeletons (Shape 2) |
| 18 × `app/admin/*/*/loading.tsx` | Form page skeletons (Shape 3) |
| `app/admin/chat-dashboard/loading.tsx` | Chat skeleton (Shape 4) |
| `app/admin/credit/loading.tsx` | Credit hub skeleton (Shape 5) |
| `app/admin/settings/escrow-service/loading.tsx` | Escrow skeleton (Shape 3) |
| `tests/unit/motion-spring.test.ts` | Spring config unit tests |
| `tests/component/sk-primitives.test.tsx` | Skeleton primitive component tests |
| `tests/component/motion-primitives.test.tsx` | Motion primitive component tests |

### Modified
| File | Change |
|------|--------|
| `package.json` | Add `motion` dependency |
| `app/globals.css` | Add `@keyframes sk-shimmer` + `.sk-shimmer` class |
| `app/admin/layout.tsx:62-72` | Remove old `animate-pulse` Suspense fallback |
| `app/admin/page.tsx` | Wrap stat cards in StaggerList, quick nav in FadeUp |
| 14 list page `page.tsx` files | Add FadeUp wrapper around return |
| 19 form + remaining `page.tsx` files | Add FadeUp wrapper around return |

---

## Task 1: Install motion + add shimmer CSS

**Files:**
- Modify: `package.json`
- Modify: `app/globals.css`
- Modify: `app/admin/layout.tsx`

- [ ] **Install motion**
```bash
npm install motion
```
Expected: `"motion": "^11.x.x"` appears in package.json dependencies.

- [ ] **Add shimmer keyframe to the end of `app/globals.css`**
```css
/* Skeleton shimmer animation */
@keyframes sk-shimmer {
  0%   { background-position: -600px 0; }
  100% { background-position:  600px 0; }
}
.sk-shimmer {
  background-size: 1200px 100%;
  animation: sk-shimmer 1.6s linear infinite;
}
```

- [ ] **Replace the Suspense fallback in `app/admin/layout.tsx`**

Find this block (around line 62):
```tsx
<Suspense
  fallback={
    <div className="container my-6 animate-pulse space-y-4 rounded-xl border bg-card p-6 shadow-sm">
      <div className="h-4 w-48 rounded bg-muted" />
      <div className="mt-4 h-24 rounded-lg bg-muted/60" />
    </div>
  }
>
  {children}
</Suspense>
```

Replace with (each route now owns its own `loading.tsx`):
```tsx
<Suspense>
  {children}
</Suspense>
```

- [ ] **Commit**
```bash
git add package.json package-lock.json app/globals.css app/admin/layout.tsx
git commit -m "feat: install motion, add sk-shimmer CSS, remove generic pulse fallback"
```

---

## Task 2: Spring config

**Files:**
- Create: `lib/motion-spring.ts`
- Create: `tests/unit/motion-spring.test.ts`

- [ ] **Write the failing test** — create `tests/unit/motion-spring.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { springs, variants } from "@/lib/motion-spring"

describe("springs", () => {
  it("entrance has stiffness 200 and damping 20", () => {
    expect(springs.entrance.stiffness).toBe(200)
    expect(springs.entrance.damping).toBe(20)
    expect(springs.entrance.mass).toBe(1)
  })
  it("all spring presets have type spring", () => {
    expect(springs.entrance.type).toBe("spring")
    expect(springs.hover.type).toBe("spring")
    expect(springs.press.type).toBe("spring")
    expect(springs.page.type).toBe("spring")
  })
  it("hover is stiffer than entrance", () => {
    expect(springs.hover.stiffness).toBeGreaterThan(springs.entrance.stiffness)
  })
  it("press is the stiffest preset", () => {
    expect(springs.press.stiffness).toBeGreaterThan(springs.hover.stiffness)
  })
})

describe("variants.fadeUp", () => {
  it("hidden state is invisible with a positive y offset", () => {
    expect(variants.fadeUp.hidden.opacity).toBe(0)
    expect(variants.fadeUp.hidden.y).toBeGreaterThan(0)
    expect(variants.fadeUp.hidden.scale).toBeLessThan(1)
  })
  it("visible state is at natural position", () => {
    expect(variants.fadeUp.visible.opacity).toBe(1)
    expect(variants.fadeUp.visible.y).toBe(0)
    expect(variants.fadeUp.visible.scale).toBe(1)
  })
})

describe("variants.stagger", () => {
  it("visible transition staggers children", () => {
    const t = variants.stagger.visible.transition
    expect(t?.staggerChildren).toBeGreaterThan(0)
  })
})
```

- [ ] **Run to confirm it fails**
```bash
npm run test:unit -- motion-spring
```
Expected: FAIL with "Cannot find module '@/lib/motion-spring'"

- [ ] **Create `lib/motion-spring.ts`**:
```ts
export const springs = {
  entrance: { type: "spring" as const, stiffness: 200, damping: 20, mass: 1 },
  hover:    { type: "spring" as const, stiffness: 300, damping: 25 },
  press:    { type: "spring" as const, stiffness: 400, damping: 30 },
  page:     { type: "spring" as const, stiffness: 180, damping: 22 },
}

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

- [ ] **Run to confirm it passes**
```bash
npm run test:unit -- motion-spring
```
Expected: PASS (7 tests)

- [ ] **Commit**
```bash
git add lib/motion-spring.ts tests/unit/motion-spring.test.ts
git commit -m "feat: add motion spring presets and animation variants"
```

---

## Task 3: SkBlock skeleton primitive

**Files:**
- Create: `components/admin/motion/skeleton/sk-block.tsx`
- Create: `tests/component/sk-primitives.test.tsx`

- [ ] **Write the failing test** — create `tests/component/sk-primitives.test.tsx`:
```tsx
import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import { SkBlock } from "@/components/admin/motion/skeleton/sk-block"

describe("SkBlock", () => {
  it("renders with the sk-shimmer class", () => {
    const { container } = render(<SkBlock w={48} h={12} color="#8b5cf6" />)
    expect(container.firstChild).toHaveClass("sk-shimmer")
  })

  it("applies numeric width and height as px values", () => {
    const { container } = render(<SkBlock w={80} h={20} color="#3b82f6" />)
    const el = container.firstChild as HTMLElement
    expect(el.style.width).toBe("80px")
    expect(el.style.height).toBe("20px")
  })

  it("accepts string dimensions", () => {
    const { container } = render(<SkBlock w="100%" h={12} color="#9ca3af" />)
    expect((container.firstChild as HTMLElement).style.width).toBe("100%")
  })

  it("builds backgroundImage using the accent colour as rgb triplet", () => {
    const { container } = render(<SkBlock w={48} h={12} color="#3b82f6" opacity={0.15} />)
    const el = container.firstChild as HTMLElement
    // #3b = 59, #82 = 130, #f6 = 246
    expect(el.style.backgroundImage).toContain("59,130,246")
  })

  it("renders without error when no color prop is given", () => {
    const { container } = render(<SkBlock w={48} h={12} />)
    expect(container.firstChild).toHaveClass("sk-shimmer")
  })
})
```

- [ ] **Run to confirm it fails**
```bash
npm run test:component -- sk-primitives
```
Expected: FAIL — module not found

- [ ] **Create `components/admin/motion/skeleton/sk-block.tsx`**:
```tsx
function hexToRgb(hex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return "156,163,175"
  return `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}`
}

const roundedMap = { sm: "4px", md: "8px", lg: "12px", full: "9999px" } as const

export function SkBlock({
  w,
  h,
  color = "#9ca3af",
  opacity = 0.18,
  rounded = "md",
  className,
}: {
  w?: number | string
  h?: number | string
  color?: string
  opacity?: number
  rounded?: keyof typeof roundedMap
  className?: string
}) {
  const rgb = hexToRgb(color)
  const lo = opacity
  const hi = Math.min(1, opacity * 1.6)
  return (
    <div
      className={`sk-shimmer${className ? ` ${className}` : ""}`}
      style={{
        width:  typeof w === "number" ? `${w}px` : w,
        height: typeof h === "number" ? `${h}px` : h,
        borderRadius: roundedMap[rounded],
        backgroundImage: `linear-gradient(90deg, rgba(${rgb},${lo}) 25%, rgba(${rgb},${hi}) 50%, rgba(${rgb},${lo}) 75%)`,
      }}
    />
  )
}
```

- [ ] **Run to confirm it passes**
```bash
npm run test:component -- sk-primitives
```
Expected: PASS (5 tests)

- [ ] **Commit**
```bash
git add components/admin/motion/skeleton/sk-block.tsx tests/component/sk-primitives.test.tsx
git commit -m "feat: add SkBlock colour-tinted shimmer skeleton primitive"
```

---

## Task 4: SkCard, SkRow, SkFormField + skeleton/index.ts

**Files:**
- Create: `components/admin/motion/skeleton/sk-card.tsx`
- Create: `components/admin/motion/skeleton/sk-row.tsx`
- Create: `components/admin/motion/skeleton/sk-form-field.tsx`
- Create: `components/admin/motion/skeleton/index.ts`
- Modify: `tests/component/sk-primitives.test.tsx`

- [ ] **Append tests to `tests/component/sk-primitives.test.tsx`**

Add these imports at the top of the file (after the existing SkBlock import):
```tsx
import { SkCard } from "@/components/admin/motion/skeleton/sk-card"
import { SkRow } from "@/components/admin/motion/skeleton/sk-row"
import { SkFormField } from "@/components/admin/motion/skeleton/sk-form-field"
```

Append these describe blocks at the end of the file:
```tsx
describe("SkCard", () => {
  it("renders a card container with 3 shimmer blocks (icon, number, label)", () => {
    const { container } = render(<SkCard accentColor="#8b5cf6" />)
    expect(container.querySelectorAll(".sk-shimmer")).toHaveLength(3)
  })
})

describe("SkRow", () => {
  it("renders shimmer blocks for avatar + name + extra cols", () => {
    const { container } = render(<SkRow cols={5} />)
    // avatar + name + 3 extra = 5 blocks
    expect(container.querySelectorAll(".sk-shimmer")).toHaveLength(5)
  })

  it("renders more blocks when cols is higher", () => {
    const { container: c5 } = render(<SkRow cols={5} />)
    const { container: c7 } = render(<SkRow cols={7} />)
    expect(c7.querySelectorAll(".sk-shimmer").length).toBeGreaterThan(
      c5.querySelectorAll(".sk-shimmer").length
    )
  })
})

describe("SkFormField", () => {
  it("renders exactly 2 shimmer blocks (label + input)", () => {
    const { container } = render(<SkFormField />)
    expect(container.querySelectorAll(".sk-shimmer")).toHaveLength(2)
  })
})
```

- [ ] **Run to confirm new tests fail**
```bash
npm run test:component -- sk-primitives
```
Expected: FAIL — new imports not found

- [ ] **Create `components/admin/motion/skeleton/sk-card.tsx`**:
```tsx
import { SkBlock } from "./sk-block"

export function SkCard({
  accentColor,
  className,
}: {
  accentColor: string
  className?: string
}) {
  return (
    <div
      className={`rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border/60${className ? ` ${className}` : ""}`}
    >
      <SkBlock w={44} h={44} color={accentColor} opacity={0.12} rounded="lg" />
      <div className="mt-4 space-y-2">
        <SkBlock w={56} h={22} color={accentColor} opacity={0.18} rounded="md" />
        <SkBlock w={80} h={10} color={accentColor} opacity={0.10} rounded="sm" />
      </div>
    </div>
  )
}
```

- [ ] **Create `components/admin/motion/skeleton/sk-row.tsx`**:
```tsx
import { SkBlock } from "./sk-block"

export function SkRow({
  cols = 5,
  accentColor = "#9ca3af",
}: {
  cols?: number
  accentColor?: string
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <SkBlock w={32} h={32} color={accentColor} opacity={0.12} rounded="lg" />
      <SkBlock w={120} h={10} color={accentColor} opacity={0.15} rounded="md" />
      {Array.from({ length: Math.max(0, cols - 2) }).map((_, i) => (
        <SkBlock key={i} w={72} h={10} color="#9ca3af" opacity={0.12} rounded="md" />
      ))}
    </div>
  )
}
```

- [ ] **Create `components/admin/motion/skeleton/sk-form-field.tsx`**:
```tsx
import { SkBlock } from "./sk-block"

export function SkFormField({ accentColor = "#9ca3af" }: { accentColor?: string }) {
  return (
    <div className="space-y-2">
      <SkBlock w={80} h={10} color={accentColor} opacity={0.14} rounded="sm" />
      <SkBlock w="100%" h={38} color={accentColor} opacity={0.08} rounded="md" />
    </div>
  )
}
```

- [ ] **Create `components/admin/motion/skeleton/index.ts`**:
```ts
export { SkBlock } from "./sk-block"
export { SkCard } from "./sk-card"
export { SkRow } from "./sk-row"
export { SkFormField } from "./sk-form-field"
```

- [ ] **Run to confirm all pass**
```bash
npm run test:component -- sk-primitives
```
Expected: PASS (all tests including the 4 new ones)

- [ ] **Commit**
```bash
git add components/admin/motion/skeleton/ tests/component/sk-primitives.test.tsx
git commit -m "feat: add SkCard, SkRow, SkFormField skeleton primitives"
```

---

## Task 5: FadeUp + StaggerList motion primitives

**Files:**
- Create: `components/admin/motion/fade-up.tsx`
- Create: `components/admin/motion/stagger-list.tsx`
- Create: `tests/component/motion-primitives.test.tsx`

`motion/react` uses `requestAnimationFrame` which jsdom doesn't support. Mock it so tests run in jsdom without errors.

- [ ] **Write the failing test** — create `tests/component/motion-primitives.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import React from "react"

vi.mock("motion/react", () => ({
  motion: {
    div: React.forwardRef(
      ({ children, className, style }: React.HTMLAttributes<HTMLDivElement>, ref: React.Ref<HTMLDivElement>) =>
        <div ref={ref} className={className} style={style} data-testid="motion-div">{children}</div>
    ),
    button: React.forwardRef(
      ({ children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>, ref: React.Ref<HTMLButtonElement>) =>
        <button ref={ref} className={className} data-testid="motion-button" {...rest}>{children}</button>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { FadeUp } from "@/components/admin/motion/fade-up"
import { StaggerList } from "@/components/admin/motion/stagger-list"

describe("FadeUp", () => {
  it("renders its children", () => {
    render(<FadeUp><span data-testid="child">hello</span></FadeUp>)
    expect(screen.getByTestId("child")).toBeInTheDocument()
  })

  it("wraps children in a motion div", () => {
    const { container } = render(<FadeUp><span>x</span></FadeUp>)
    expect(container.querySelector("[data-testid='motion-div']")).toBeInTheDocument()
  })

  it("passes className to the wrapper", () => {
    const { container } = render(<FadeUp className="my-class"><span>x</span></FadeUp>)
    expect(container.querySelector(".my-class")).toBeInTheDocument()
  })
})

describe("StaggerList", () => {
  it("renders all children", () => {
    render(
      <StaggerList>
        <span data-testid="a">A</span>
        <span data-testid="b">B</span>
        <span data-testid="c">C</span>
      </StaggerList>
    )
    expect(screen.getByTestId("a")).toBeInTheDocument()
    expect(screen.getByTestId("b")).toBeInTheDocument()
    expect(screen.getByTestId("c")).toBeInTheDocument()
  })

  it("wraps each child in a motion div for stagger (container + N children)", () => {
    const { container } = render(
      <StaggerList>
        <span>A</span>
        <span>B</span>
      </StaggerList>
    )
    // 1 container motion.div + 2 per-child motion.divs = 3
    expect(container.querySelectorAll("[data-testid='motion-div']").length).toBe(3)
  })
})
```

- [ ] **Run to confirm it fails**
```bash
npm run test:component -- motion-primitives
```
Expected: FAIL — modules not found

- [ ] **Create `components/admin/motion/fade-up.tsx`**:
```tsx
"use client"
import { motion } from "motion/react"
import { springs, variants } from "@/lib/motion-spring"

export function FadeUp({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={variants.fadeUp}
      transition={{ ...springs.entrance, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
```

- [ ] **Create `components/admin/motion/stagger-list.tsx`**:
```tsx
"use client"
import React from "react"
import { motion } from "motion/react"
import { variants } from "@/lib/motion-spring"

export function StaggerList({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={variants.stagger}
      className={className}
    >
      {React.Children.map(children, (child, i) => (
        <motion.div key={i} variants={variants.fadeUp}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  )
}
```

- [ ] **Run to confirm it passes**
```bash
npm run test:component -- motion-primitives
```
Expected: PASS

- [ ] **Commit**
```bash
git add components/admin/motion/fade-up.tsx components/admin/motion/stagger-list.tsx tests/component/motion-primitives.test.tsx
git commit -m "feat: add FadeUp and StaggerList motion primitives"
```

---

## Task 6: HoverCard + PressButton + motion/index.ts

**Files:**
- Create: `components/admin/motion/hover-card.tsx`
- Create: `components/admin/motion/press-button.tsx`
- Create: `components/admin/motion/index.ts`
- Modify: `tests/component/motion-primitives.test.tsx`

- [ ] **Append tests** to `tests/component/motion-primitives.test.tsx`

Add these imports after the existing motion/react mock block (before the FadeUp/StaggerList imports):
```tsx
import { HoverCard } from "@/components/admin/motion/hover-card"
import { PressButton } from "@/components/admin/motion/press-button"
```

Append these describe blocks at the end of the file:
```tsx
describe("HoverCard", () => {
  it("renders its children", () => {
    render(<HoverCard><span data-testid="inner">card</span></HoverCard>)
    expect(screen.getByTestId("inner")).toBeInTheDocument()
  })

  it("wraps children in a motion div", () => {
    const { container } = render(<HoverCard><span>x</span></HoverCard>)
    expect(container.querySelector("[data-testid='motion-div']")).toBeInTheDocument()
  })
})

describe("PressButton", () => {
  it("renders as a button element", () => {
    const { container } = render(<PressButton>Save</PressButton>)
    expect(container.querySelector("[data-testid='motion-button']")).toBeInTheDocument()
  })

  it("renders children", () => {
    render(<PressButton>Click me</PressButton>)
    expect(screen.getByText("Click me")).toBeInTheDocument()
  })

  it("forwards className to the button", () => {
    const { container } = render(<PressButton className="my-btn">OK</PressButton>)
    expect(container.querySelector(".my-btn")).toBeInTheDocument()
  })
})
```

- [ ] **Run to confirm new tests fail**
```bash
npm run test:component -- motion-primitives
```
Expected: FAIL — HoverCard, PressButton not found

- [ ] **Create `components/admin/motion/hover-card.tsx`**:
```tsx
"use client"
import { motion } from "motion/react"
import { springs } from "@/lib/motion-spring"

export function HoverCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.10)" }}
      whileTap={{ scale: 0.98 }}
      transition={springs.hover}
      className={className}
    >
      {children}
    </motion.div>
  )
}
```

- [ ] **Create `components/admin/motion/press-button.tsx`**

PressButton is a drop-in replacement for shadcn's `<Button>` whenever you want a press-scale animation. It generates identical Tailwind classes.

```tsx
"use client"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import type { VariantProps } from "class-variance-authority"
import { springs } from "@/lib/motion-spring"

export function PressButton({
  children,
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={springs.press}
      className={cn(buttonVariants({ variant, size }), className)}
      {...(props as object)}
    >
      {children}
    </motion.button>
  )
}
```

- [ ] **Create `components/admin/motion/index.ts`**:
```ts
export { FadeUp } from "./fade-up"
export { StaggerList } from "./stagger-list"
export { HoverCard } from "./hover-card"
export { PressButton } from "./press-button"
export { SkBlock, SkCard, SkRow, SkFormField } from "./skeleton"
```

- [ ] **Run to confirm all pass**
```bash
npm run test:component -- motion-primitives
```
Expected: PASS

- [ ] **Commit**
```bash
git add components/admin/motion/hover-card.tsx components/admin/motion/press-button.tsx components/admin/motion/index.ts tests/component/motion-primitives.test.tsx
git commit -m "feat: add HoverCard, PressButton, motion/index re-exports"
```

---

## Task 7: Page transition template

**Files:**
- Create: `app/admin/template.tsx`

`template.tsx` in Next.js App Router unmounts and remounts on every client navigation. Each remount starts the `initial → animate` spring fresh — no `AnimatePresence` needed. There is no exit animation (exit animations fight with Next.js streaming and block route changes).

- [ ] **Create `app/admin/template.tsx`**:
```tsx
"use client"
import { motion } from "motion/react"
import { springs } from "@/lib/motion-spring"

export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.page}
    >
      {children}
    </motion.div>
  )
}
```

- [ ] **Commit**
```bash
git add app/admin/template.tsx
git commit -m "feat: add page transition spring via admin template.tsx"
```

---

## Task 8: Dashboard loading.tsx (Shape 1)

**Files:**
- Create: `app/admin/loading.tsx`

- [ ] **Create `app/admin/loading.tsx`**:
```tsx
import { SkBlock, SkCard } from "@/components/admin/motion/skeleton"

export default function AdminDashboardLoading() {
  return (
    <div className="space-y-8 py-2">
      <div className="space-y-2">
        <SkBlock w={140} h={24} color="#8b5cf6" opacity={0.16} rounded="md" />
        <SkBlock w={240} h={12} color="#8b5cf6" opacity={0.10} rounded="sm" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SkCard accentColor="#8b5cf6" />
        <SkCard accentColor="#3b82f6" />
        <SkCard accentColor="#f59e0b" />
        <SkCard accentColor="#22c55e" />
      </div>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border/40" />
        <SkBlock w={130} h={10} color="#9ca3af" opacity={0.14} rounded="sm" />
        <div className="h-px flex-1 bg-border/40" />
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {Array.from({ length: 11 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2.5 rounded-xl bg-card p-4 shadow-sm ring-1 ring-border/60">
            <SkBlock w={40} h={40} color="#9ca3af" opacity={0.13} rounded="lg" />
            <SkBlock w={48} h={10} color="#9ca3af" opacity={0.11} rounded="sm" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Commit**
```bash
git add app/admin/loading.tsx
git commit -m "feat: add dashboard loading skeleton (Shape 1)"
```

---

## Task 9: List page loading.tsx files (Shape 2 × 14)

**Files:** 14 new `loading.tsx` files.

All follow an identical structure — page header SkBlocks + filter bar SkBlocks + 8 SkRows in a card container. Only the export function name and `accentColor` value change.

- [ ] **Create `app/admin/products/loading.tsx`** (full template — use as the reference):
```tsx
import { SkBlock, SkRow } from "@/components/admin/motion/skeleton"

export default function ProductsLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <SkBlock w={120} h={22} color="#3b82f6" opacity={0.18} rounded="md" />
        <SkBlock w={200} h={11} color="#3b82f6" opacity={0.10} rounded="sm" />
      </div>
      <div className="flex items-center gap-2">
        <SkBlock w={220} h={36} color="#3b82f6" opacity={0.10} rounded="lg" />
        <SkBlock w={88}  h={36} color="#3b82f6" opacity={0.10} rounded="lg" />
        <SkBlock w={88}  h={36} color="#3b82f6" opacity={0.10} rounded="lg" />
        <div className="ml-auto">
          <SkBlock w={110} h={36} color="#3b82f6" opacity={0.12} rounded="lg" />
        </div>
      </div>
      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-border/60">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="border-b border-border/40 last:border-b-0">
            <SkRow accentColor="#3b82f6" cols={5} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Create the remaining 13 list loading files** using the same structure, substituting the export name and `accentColor`:

| File path | Export name | accentColor |
|-----------|-------------|-------------|
| `app/admin/categories/loading.tsx` | `CategoriesLoading` | `#f59e0b` |
| `app/admin/users/loading.tsx` | `UsersLoading` | `#ec4899` |
| `app/admin/users/[id]/products/loading.tsx` | `UserProductsLoading` | `#ec4899` |
| `app/admin/laboratory/loading.tsx` | `LaboratoryLoading` | `#22c55e` |
| `app/admin/origin/loading.tsx` | `OriginLoading` | `#14b8a6` |
| `app/admin/news/loading.tsx` | `NewsLoading` | `#22c55e` |
| `app/admin/articles/loading.tsx` | `ArticlesLoading` | `#64748b` |
| `app/admin/messages/loading.tsx` | `MessagesLoading` | `#d946ef` |
| `app/admin/collector-piece-show-requests/loading.tsx` | `CollectorRequestsLoading` | `#8b5cf6` |
| `app/admin/credit/purchase-requests/loading.tsx` | `PurchaseRequestsLoading` | `#f59e0b` |
| `app/admin/credit/premium-dealer-subscriptions/loading.tsx` | `DealerSubscriptionsLoading` | `#eab308` |
| `app/admin/credit/transactions/loading.tsx` | `TransactionsLoading` | `#8b5cf6` |
| `app/admin/settings/rating-tags/loading.tsx` | `RatingTagsLoading` | `#ef4444` |

- [ ] **Commit**
```bash
git add app/admin/products/loading.tsx app/admin/categories/loading.tsx \
  app/admin/users/loading.tsx "app/admin/users/[id]/products/loading.tsx" \
  app/admin/laboratory/loading.tsx app/admin/origin/loading.tsx \
  app/admin/news/loading.tsx app/admin/articles/loading.tsx \
  app/admin/messages/loading.tsx \
  app/admin/collector-piece-show-requests/loading.tsx \
  app/admin/credit/purchase-requests/loading.tsx \
  "app/admin/credit/premium-dealer-subscriptions/loading.tsx" \
  app/admin/credit/transactions/loading.tsx \
  app/admin/settings/rating-tags/loading.tsx
git commit -m "feat: add list-page loading skeletons (Shape 2, 14 routes)"
```

---

## Task 10: Form loading.tsx files (Shape 3 × 18)

**Files:** 18 form route `loading.tsx` files.

Structure: back-link + title SkBlocks, then a white card with 5 `SkFormField` rows and a submit button block. Note: `app/admin/users/[id]/edit/loading.tsx` already exists with an `animate-pulse` skeleton — replace its contents.

- [ ] **Create `app/admin/products/new/loading.tsx`** (full template):
```tsx
import { SkBlock, SkFormField } from "@/components/admin/motion/skeleton"

export default function ProductsNewLoading() {
  return (
    <div className="container my-4 w-full max-w-screen-2xl space-y-6 md:my-6">
      <div className="space-y-1.5">
        <SkBlock w={72} h={11} color="#3b82f6" opacity={0.14} rounded="sm" />
        <SkBlock w={160} h={24} color="#3b82f6" opacity={0.18} rounded="md" />
      </div>
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-border/60 space-y-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkFormField key={i} accentColor="#3b82f6" />
        ))}
        <div className="flex justify-end pt-2">
          <SkBlock w={110} h={38} color="#3b82f6" opacity={0.18} rounded="lg" />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Create the remaining 17 form loading files** with the same structure:

| File path | Export name | accentColor |
|-----------|-------------|-------------|
| `app/admin/products/[id]/edit/loading.tsx` | `ProductEditLoading` | `#3b82f6` |
| `app/admin/categories/new/loading.tsx` | `CategoryNewLoading` | `#f59e0b` |
| `app/admin/categories/[id]/edit/loading.tsx` | `CategoryEditLoading` | `#f59e0b` |
| `app/admin/laboratory/new/loading.tsx` | `LaboratoryNewLoading` | `#22c55e` |
| `app/admin/laboratory/[id]/edit/loading.tsx` | `LaboratoryEditLoading` | `#22c55e` |
| `app/admin/origin/new/loading.tsx` | `OriginNewLoading` | `#14b8a6` |
| `app/admin/origin/[id]/edit/loading.tsx` | `OriginEditLoading` | `#14b8a6` |
| `app/admin/news/new/loading.tsx` | `NewsNewLoading` | `#22c55e` |
| `app/admin/news/[id]/edit/loading.tsx` | `NewsEditLoading` | `#22c55e` |
| `app/admin/articles/new/loading.tsx` | `ArticleNewLoading` | `#64748b` |
| `app/admin/articles/[id]/edit/loading.tsx` | `ArticleEditLoading` | `#64748b` |
| `app/admin/messages/new/loading.tsx` | `MessageNewLoading` | `#d946ef` |
| `app/admin/messages/[id]/edit/loading.tsx` | `MessageEditLoading` | `#d946ef` |
| `app/admin/users/new/loading.tsx` | `UserNewLoading` | `#ec4899` |
| `app/admin/users/[id]/edit/loading.tsx` | `UserEditLoading` | `#ec4899` |
| `app/admin/settings/rating-tags/new/loading.tsx` | `RatingTagNewLoading` | `#ef4444` |
| `app/admin/settings/rating-tags/[id]/edit/loading.tsx` | `RatingTagEditLoading` | `#ef4444` |

- [ ] **Commit**
```bash
git add "app/admin/products/new/loading.tsx" "app/admin/products/[id]/edit/loading.tsx" \
  "app/admin/categories/new/loading.tsx" "app/admin/categories/[id]/edit/loading.tsx" \
  "app/admin/laboratory/new/loading.tsx" "app/admin/laboratory/[id]/edit/loading.tsx" \
  "app/admin/origin/new/loading.tsx" "app/admin/origin/[id]/edit/loading.tsx" \
  "app/admin/news/new/loading.tsx" "app/admin/news/[id]/edit/loading.tsx" \
  "app/admin/articles/new/loading.tsx" "app/admin/articles/[id]/edit/loading.tsx" \
  "app/admin/messages/new/loading.tsx" "app/admin/messages/[id]/edit/loading.tsx" \
  "app/admin/users/new/loading.tsx" "app/admin/users/[id]/edit/loading.tsx" \
  "app/admin/settings/rating-tags/new/loading.tsx" \
  "app/admin/settings/rating-tags/[id]/edit/loading.tsx"
git commit -m "feat: add form-page loading skeletons (Shape 3, 18 routes)"
```

---

## Task 11: Chat, Credit, Escrow loading.tsx

**Files:**
- Create: `app/admin/chat-dashboard/loading.tsx`
- Create: `app/admin/credit/loading.tsx`
- Create: `app/admin/settings/escrow-service/loading.tsx`

- [ ] **Create `app/admin/chat-dashboard/loading.tsx`** (Shape 4):
```tsx
import { SkBlock, SkRow } from "@/components/admin/motion/skeleton"

export default function ChatDashboardLoading() {
  return (
    <div className="flex h-[calc(100vh-80px)] gap-0 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-border/60">
      <div className="w-80 shrink-0 space-y-1 border-r border-border/60 p-3">
        <div className="mb-3">
          <SkBlock w="100%" h={36} color="#0ea5e9" opacity={0.10} rounded="lg" />
        </div>
        {Array.from({ length: 7 }).map((_, i) => (
          <SkRow key={i} accentColor="#0ea5e9" cols={3} />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <SkBlock w="100%" h={48} color="#0ea5e9" opacity={0.07} rounded="lg" />
        <div className="flex-1">
          <SkBlock w="100%" h="100%" color="#0ea5e9" opacity={0.04} rounded="lg" />
        </div>
        <SkBlock w="100%" h={48} color="#0ea5e9" opacity={0.07} rounded="lg" />
      </div>
    </div>
  )
}
```

- [ ] **Create `app/admin/credit/loading.tsx`** (Shape 5 — package tier cards + list):
```tsx
import { SkBlock, SkCard } from "@/components/admin/motion/skeleton"

export default function CreditLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <SkBlock w={140} h={22} color="#8b5cf6" opacity={0.18} rounded="md" />
        <SkBlock w={220} h={11} color="#8b5cf6" opacity={0.10} rounded="sm" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SkCard accentColor="#8b5cf6" />
        <SkCard accentColor="#8b5cf6" />
        <SkCard accentColor="#8b5cf6" />
      </div>
      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-border/60">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border/40 px-4 py-3 last:border-b-0">
            <SkBlock w={32} h={32} color="#8b5cf6" opacity={0.12} rounded="lg" />
            <SkBlock w={140} h={11} color="#8b5cf6" opacity={0.15} rounded="md" />
            <div className="ml-auto flex gap-2">
              <SkBlock w={72} h={28} color="#8b5cf6" opacity={0.12} rounded="md" />
              <SkBlock w={72} h={28} color="#8b5cf6" opacity={0.12} rounded="md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Create `app/admin/settings/escrow-service/loading.tsx`** (Shape 3 — settings form):
```tsx
import { SkBlock, SkFormField } from "@/components/admin/motion/skeleton"

export default function EscrowServiceLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <SkBlock w={160} h={22} color="#f43f5e" opacity={0.18} rounded="md" />
        <SkBlock w={240} h={11} color="#f43f5e" opacity={0.10} rounded="sm" />
      </div>
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-border/60 space-y-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkFormField key={i} accentColor="#f43f5e" />
        ))}
        <div className="flex justify-end pt-2">
          <SkBlock w={110} h={38} color="#f43f5e" opacity={0.18} rounded="lg" />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Commit**
```bash
git add app/admin/chat-dashboard/loading.tsx app/admin/credit/loading.tsx \
  app/admin/settings/escrow-service/loading.tsx
git commit -m "feat: add chat, credit, escrow loading skeletons"
```

---

## Task 12: Wire StaggerList into dashboard page

**Files:**
- Modify: `app/admin/page.tsx`

The dashboard has stat cards and a quick-nav grid. StaggerList cascades the stat cards in. FadeUp on the quick nav section adds a slight delay so it appears after the cards.

The existing CSS hover states on the Link cards (`hover:-translate-y-0.5 active:translate-y-0`) stay unchanged — they're CSS transitions, not Motion, and don't conflict with the spring entrance.

- [ ] **Add imports to `app/admin/page.tsx`**

At the top of the file, add:
```tsx
import { StaggerList, FadeUp } from "@/components/admin/motion"
```

- [ ] **Replace stat cards `<div>` with `StaggerList`**

Find:
```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
```

Replace with:
```tsx
<StaggerList className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
```

And close with `</StaggerList>` instead of `</div>`. The four Link children inside remain completely unchanged.

- [ ] **Wrap quick navigation section in FadeUp**

Find the comment `{/* Quick navigation */}` and wrap the entire section in a `<FadeUp delay={0.32}>` wrapper:
```tsx
{/* Quick navigation */}
<FadeUp delay={0.32}>
  <div>
    <div className="mb-4 flex items-center gap-3">
      ...existing divider unchanged...
    </div>
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-6 xl:grid-cols-6">
      ...existing quickActions.map unchanged...
    </div>
  </div>
</FadeUp>
```

- [ ] **Run tests**
```bash
npm run test
```
Expected: all pass

- [ ] **Commit**
```bash
git add app/admin/page.tsx
git commit -m "feat: wire StaggerList and FadeUp into dashboard page"
```

---

## Task 13: Wire FadeUp into list pages

**Files:** 14 list page `page.tsx` files.

`template.tsx` animates the whole page container (opacity + y). `FadeUp` on the page content adds a secondary spring on the content block, creating a layered entrance: the page container arrives first, then the content blooms within it.

- [ ] **Apply to all 14 list pages** — same change for each:

Add import at the top:
```tsx
import { FadeUp } from "@/components/admin/motion"
```

Wrap the return statement's outermost element:
```tsx
// Before:
return (
  <div className="...">...</div>
)

// After:
return (
  <FadeUp>
    <div className="...">...</div>
  </FadeUp>
)
```

Files to update:
- `app/admin/products/page.tsx`
- `app/admin/categories/page.tsx`
- `app/admin/users/page.tsx`
- `app/admin/users/[id]/products/page.tsx`
- `app/admin/laboratory/page.tsx`
- `app/admin/origin/page.tsx`
- `app/admin/news/page.tsx`
- `app/admin/articles/page.tsx`
- `app/admin/messages/page.tsx`
- `app/admin/collector-piece-show-requests/page.tsx`
- `app/admin/credit/purchase-requests/page.tsx`
- `app/admin/credit/premium-dealer-subscriptions/page.tsx`
- `app/admin/credit/transactions/page.tsx`
- `app/admin/settings/rating-tags/page.tsx`

- [ ] **Run tests**
```bash
npm run test
```
Expected: all pass

- [ ] **Commit**
```bash
git add app/admin/products/page.tsx app/admin/categories/page.tsx \
  app/admin/users/page.tsx "app/admin/users/[id]/products/page.tsx" \
  app/admin/laboratory/page.tsx app/admin/origin/page.tsx \
  app/admin/news/page.tsx app/admin/articles/page.tsx \
  app/admin/messages/page.tsx app/admin/collector-piece-show-requests/page.tsx \
  app/admin/credit/purchase-requests/page.tsx \
  "app/admin/credit/premium-dealer-subscriptions/page.tsx" \
  app/admin/credit/transactions/page.tsx \
  app/admin/settings/rating-tags/page.tsx
git commit -m "feat: wire FadeUp into all list pages"
```

---

## Task 14: Wire FadeUp into form + remaining pages

**Files:** 19 page files (form + chat + credit + escrow).

Same pattern as Task 13.

- [ ] **Apply FadeUp to all remaining pages**:
- `app/admin/products/new/page.tsx`
- `app/admin/products/[id]/edit/page.tsx`
- `app/admin/categories/new/page.tsx`
- `app/admin/categories/[id]/edit/page.tsx`
- `app/admin/laboratory/new/page.tsx`
- `app/admin/laboratory/[id]/edit/page.tsx`
- `app/admin/origin/new/page.tsx`
- `app/admin/origin/[id]/edit/page.tsx`
- `app/admin/news/new/page.tsx`
- `app/admin/news/[id]/edit/page.tsx`
- `app/admin/articles/new/page.tsx`
- `app/admin/articles/[id]/edit/page.tsx`
- `app/admin/messages/new/page.tsx`
- `app/admin/messages/[id]/edit/page.tsx`
- `app/admin/users/new/page.tsx`
- `app/admin/users/[id]/edit/page.tsx`
- `app/admin/chat-dashboard/page.tsx`
- `app/admin/credit/page.tsx`
- `app/admin/settings/escrow-service/page.tsx`

- [ ] **Run tests**
```bash
npm run test
```
Expected: all pass

- [ ] **Commit**
```bash
git add "app/admin/products/new/page.tsx" "app/admin/products/[id]/edit/page.tsx" \
  "app/admin/categories/new/page.tsx" "app/admin/categories/[id]/edit/page.tsx" \
  "app/admin/laboratory/new/page.tsx" "app/admin/laboratory/[id]/edit/page.tsx" \
  "app/admin/origin/new/page.tsx" "app/admin/origin/[id]/edit/page.tsx" \
  "app/admin/news/new/page.tsx" "app/admin/news/[id]/edit/page.tsx" \
  "app/admin/articles/new/page.tsx" "app/admin/articles/[id]/edit/page.tsx" \
  "app/admin/messages/new/page.tsx" "app/admin/messages/[id]/edit/page.tsx" \
  "app/admin/users/new/page.tsx" "app/admin/users/[id]/edit/page.tsx" \
  app/admin/chat-dashboard/page.tsx app/admin/credit/page.tsx \
  app/admin/settings/escrow-service/page.tsx
git commit -m "feat: wire FadeUp into form, chat, credit, and settings pages"
```

---

## Task 15: PressButton on header action buttons

**Files:** The 7 list pages that have `lv-new-btn` / `lv-export-btn` header buttons.

> **Note:** Form submit buttons (Save, Create, Approve, Reject) live inside feature components like `ProductForm`, `CategoryForm`, etc. Wiring PressButton into those is a follow-up task per feature component. This task covers the header-level buttons visible on every list page.

The `lv-new-btn` links and `lv-export-btn` buttons are in list page headers. They're either `<Link>` or `<button>` elements. For button elements, replace with `PressButton`. For Link elements, wrap in `motion.div whileTap` directly (PressButton renders `<button>`, not `<a>`).

- [ ] **Add PressButton import and wrap `<button>` elements** in list page headers

Pattern for pages with a `<button>` element (e.g. export button):

```tsx
// Add import:
import { PressButton } from "@/components/admin/motion"

// Replace:
<button className="lv-export-btn">
  <Download /> Export Excel
</button>

// With:
<PressButton className="lv-export-btn" type="button">
  <Download /> Export Excel
</PressButton>
```

Apply to these files (check each file — only replace `<button>` elements, not `<Link>`):
- `app/admin/products/page.tsx` — has `<button className="lv-export-btn">`
- `app/admin/categories/page.tsx`
- `app/admin/laboratory/page.tsx`
- `app/admin/origin/page.tsx`
- `app/admin/settings/rating-tags/page.tsx`
- `app/admin/credit/purchase-requests/page.tsx`
- `app/admin/credit/premium-dealer-subscriptions/page.tsx`

- [ ] **Run tests**
```bash
npm run test
```
Expected: all pass

- [ ] **Commit**
```bash
git add app/admin/products/page.tsx app/admin/categories/page.tsx \
  app/admin/laboratory/page.tsx app/admin/origin/page.tsx \
  app/admin/settings/rating-tags/page.tsx \
  app/admin/credit/purchase-requests/page.tsx \
  "app/admin/credit/premium-dealer-subscriptions/page.tsx"
git commit -m "feat: apply PressButton to list page header action buttons"
```

---

## Task 16: Final verification

- [ ] **Run full test suite**
```bash
npm run test
```
Expected: all tests pass (unit + api + integration + component)

- [ ] **Build check**
```bash
npm run build
```
Expected: successful build with no TypeScript errors. If type errors appear (e.g. motion type mismatches), fix them and commit before proceeding.

- [ ] **Start dev server and verify visually**
```bash
npm run dev
```
Open `http://localhost:3000/admin` and verify:
1. Dashboard stat cards spring in with a staggered cascade on page load
2. Quick nav grid fades in slightly after the stat cards
3. Navigate to `/admin/products` — the page springs in from a slight y offset
4. Navigate back to `/admin` — the page springs in again (template.tsx re-mounts)
5. Navigate to `/admin/products/new` — a skeleton with blue-tinted shimmer appears during load
6. Navigate to `/admin/users` — a skeleton with pink-tinted shimmer appears during load
7. Hover over a stat card — CSS hover effect still works (translate-y, shadow)

- [ ] **Commit fix if build revealed issues**
```bash
git add <affected files>
git commit -m "fix: resolve type errors from motion wiring"
```
