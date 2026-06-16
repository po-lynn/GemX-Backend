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
