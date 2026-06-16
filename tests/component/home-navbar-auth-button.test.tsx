import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
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

afterEach(() => {
  cleanup()
})

describe("HomeNavbarAuthButton", () => {
  it("renders skeleton while session is loading (isPending true)", () => {
    mockUseSession.mockReturnValue({ data: null, isPending: true })
    const { container } = render(<HomeNavbarAuthButton />)
    expect(container.querySelector("[data-testid='auth-skeleton']")).toBeTruthy()
    expect(screen.queryByRole("link")).toBeNull()
  })

  it("renders skeleton when not yet mounted (SSR state)", () => {
    mockUseSyncExternalStore.mockReturnValue(false)
    mockUseSession.mockReturnValue({ data: null, isPending: false })
    const { container } = render(<HomeNavbarAuthButton />)
    expect(container.querySelector("[data-testid='auth-skeleton']")).toBeTruthy()
  })

  it("renders Sign in link when session resolves to null (not logged in)", () => {
    mockUseSession.mockReturnValue({ data: null, isPending: false })
    render(<HomeNavbarAuthButton />)
    const link = screen.getByRole("link", { name: /sign in/i })
    expect(link).toHaveAttribute("href", "/login")
  })

  it("renders Dashboard link for admin role", () => {
    mockUseSession.mockReturnValue({ data: { user: { role: "admin" } }, isPending: false })
    render(<HomeNavbarAuthButton />)
    const link = screen.getByRole("link", { name: /dashboard/i })
    expect(link).toHaveAttribute("href", "/admin")
  })

  it("renders Dashboard link for internal role", () => {
    mockUseSession.mockReturnValue({ data: { user: { role: "internal" } }, isPending: false })
    render(<HomeNavbarAuthButton />)
    const link = screen.getByRole("link", { name: /dashboard/i })
    expect(link).toHaveAttribute("href", "/admin")
  })

  it("renders My Account link for portal role", () => {
    mockUseSession.mockReturnValue({ data: { user: { role: "portal" } }, isPending: false })
    render(<HomeNavbarAuthButton />)
    const link = screen.getByRole("link", { name: /my account/i })
    expect(link).toHaveAttribute("href", "/portal")
  })

  it("renders Sign in for mobile-only user role (no web access)", () => {
    mockUseSession.mockReturnValue({ data: { user: { role: "user" } }, isPending: false })
    render(<HomeNavbarAuthButton />)
    const link = screen.getByRole("link", { name: /sign in/i })
    expect(link).toHaveAttribute("href", "/login")
  })
})
