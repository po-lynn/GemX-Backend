# Home Navbar Auth Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static "Sign in" button in the home page navbar with a session-aware button that routes each role to their correct destination.

**Architecture:** Extract auth logic into a `"use client"` component (`HomeNavbarAuthButton`) that uses `authClient.useSession()` and renders based on role. `HomeNavbar` stays a server component and simply renders `<HomeNavbarAuthButton />` in place of the static button.

**Tech Stack:** Next.js App Router, Better Auth (`authClient.useSession()`), React `useSyncExternalStore` (SSR-safe mount guard), shadcn/ui `Button`, Vitest + @testing-library/react

---

## File Map

| Action | File |
|--------|------|
| Create | `components/home/HomeNavbarAuthButton.tsx` |
| Modify | `components/home/HomeNavbar.tsx` |
| Create | `tests/component/home-navbar-auth-button.test.tsx` |

---

### Task 1: Create `HomeNavbarAuthButton` with tests

**Files:**
- Create: `components/home/HomeNavbarAuthButton.tsx`
- Create: `tests/component/home-navbar-auth-button.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/component/home-navbar-auth-button.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import HomeNavbarAuthButton from "@/components/home/HomeNavbarAuthButton"

// Mock authClient so tests don't need a real session
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: vi.fn(),
  },
}))

// Mock useSyncExternalStore so we can control mounted state
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>()
  return {
    ...actual,
    useSyncExternalStore: vi.fn(),
  }
})

import { authClient } from "@/lib/auth-client"
import { useSyncExternalStore } from "react"

const mockUseSession = authClient.useSession as ReturnType<typeof vi.fn>
const mockUseSyncExternalStore = useSyncExternalStore as ReturnType<typeof vi.fn>

beforeEach(() => {
  // Default: component is mounted (client-side)
  mockUseSyncExternalStore.mockReturnValue(true)
})

describe("HomeNavbarAuthButton", () => {
  it("renders skeleton while session is loading (no session and no error)", () => {
    // Mounted but session hasn't resolved yet
    mockUseSession.mockReturnValue({ data: null, error: null })
    const { container } = render(<HomeNavbarAuthButton />)
    // Skeleton is a div with animate-pulse, no link
    expect(container.querySelector("[data-testid='auth-skeleton']")).toBeTruthy()
    expect(screen.queryByRole("link")).toBeNull()
  })

  it("renders skeleton when not yet mounted (SSR state)", () => {
    // useSyncExternalStore returns false on server
    mockUseSyncExternalStore.mockReturnValue(false)
    mockUseSession.mockReturnValue({ data: null, error: null })
    const { container } = render(<HomeNavbarAuthButton />)
    expect(container.querySelector("[data-testid='auth-skeleton']")).toBeTruthy()
  })

  it("renders Sign in link when session resolves to null (not logged in)", () => {
    mockUseSession.mockReturnValue({ data: null, error: new Error("no session") })
    render(<HomeNavbarAuthButton />)
    const link = screen.getByRole("link", { name: /sign in/i })
    expect(link).toHaveAttribute("href", "/login")
  })

  it("renders Dashboard link for admin role", () => {
    mockUseSession.mockReturnValue({
      data: { user: { role: "admin" } },
      error: null,
    })
    render(<HomeNavbarAuthButton />)
    const link = screen.getByRole("link", { name: /dashboard/i })
    expect(link).toHaveAttribute("href", "/admin")
  })

  it("renders Dashboard link for internal role", () => {
    mockUseSession.mockReturnValue({
      data: { user: { role: "internal" } },
      error: null,
    })
    render(<HomeNavbarAuthButton />)
    const link = screen.getByRole("link", { name: /dashboard/i })
    expect(link).toHaveAttribute("href", "/admin")
  })

  it("renders My Account link for portal user role", () => {
    mockUseSession.mockReturnValue({
      data: { user: { role: "user" } },
      error: null,
    })
    render(<HomeNavbarAuthButton />)
    const link = screen.getByRole("link", { name: /my account/i })
    expect(link).toHaveAttribute("href", "/portal")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:component -- home-navbar-auth-button
```

Expected: All tests FAIL with "Cannot find module" or similar — the component doesn't exist yet.

- [ ] **Step 3: Create `HomeNavbarAuthButton.tsx`**

```tsx
"use client"

import { useSyncExternalStore } from "react"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"

function useIsMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}

const Skeleton = () => (
  <div
    data-testid="auth-skeleton"
    className="h-9 w-24 animate-pulse rounded-md bg-muted"
  />
)

export default function HomeNavbarAuthButton() {
  const { data: session, error } = authClient.useSession()
  const mounted = useIsMounted()

  if (!mounted || (!session && !error)) {
    return <Skeleton />
  }

  const role = session?.user?.role

  if (role === "admin" || role === "internal") {
    return (
      <Button size="sm" asChild>
        <Link href="/admin">Dashboard</Link>
      </Button>
    )
  }

  if (role === "user") {
    return (
      <Button size="sm" asChild>
        <Link href="/portal">My Account</Link>
      </Button>
    )
  }

  return (
    <Button size="sm" asChild>
      <Link href="/login">Sign in</Link>
    </Button>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:component -- home-navbar-auth-button
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add components/home/HomeNavbarAuthButton.tsx tests/component/home-navbar-auth-button.test.tsx
git commit -m "feat: add HomeNavbarAuthButton with role-aware routing"
```

---

### Task 2: Wire `HomeNavbarAuthButton` into `HomeNavbar`

**Files:**
- Modify: `components/home/HomeNavbar.tsx`

- [ ] **Step 1: Replace the static Sign in button**

Open `components/home/HomeNavbar.tsx`. The current button block is:

```tsx
<div className="flex items-center gap-3">
  <Button size="sm" asChild>
    <Link href="/login">Sign in</Link>
  </Button>

</div>
```

Replace it with:

```tsx
import HomeNavbarAuthButton from "@/components/home/HomeNavbarAuthButton"

// ...

<div className="flex items-center gap-3">
  <HomeNavbarAuthButton />
</div>
```

Also remove the now-unused `Button` import and `Link` import if they are no longer used elsewhere in the file (check the nav links — `Link` is still used for the logo and nav items, so keep it; `Button` is only used for the sign-in button, so remove it).

The final file should look like:

```tsx
import Link from "next/link"
import { Gem } from "lucide-react"
import HomeNavbarAuthButton from "@/components/home/HomeNavbarAuthButton"

export function HomeNavbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[var(--home-header-bg)]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight text-foreground"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Gem className="h-5 w-5" />
          </span>
          <span className="text-lg">GemX</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <Link
            href="/#app"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Download app
          </Link>
          <Link
            href="/#categories"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Categories
          </Link>
          <Link
            href="/#why-us"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Why Us
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <HomeNavbarAuthButton />
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
npm run test
```

Expected: All tests pass. No regressions.

- [ ] **Step 3: Commit**

```bash
git add components/home/HomeNavbar.tsx
git commit -m "feat: wire HomeNavbarAuthButton into HomeNavbar"
```
