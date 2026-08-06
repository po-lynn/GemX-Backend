import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import { AdminSidebar } from "@/components/admin/AdminSidebar"

// This project doesn't enable vitest's `globals: true`, so
// @testing-library/react's implicit auto-cleanup hook never registers —
// each test must unmount explicitly, matching the pattern already used in
// tests/component/admin-sidebar-configuration.test.tsx.
afterEach(cleanup)

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/reviews/cases" }))
vi.mock("@/features/chat/context/admin-chat-notification-context", () => ({
  useAdminChatNotifications: () => ({ totalUnread: 0 }),
}))
vi.mock("@/features/reviews/hooks/use-reviews-badge-counts", () => ({
  useReviewsBadgeCounts: () => ({ openCases: 38, archivedSellers: 29 }),
}))

describe("AdminSidebar — Trust & Reputation", () => {
  beforeEach(() => vi.clearAllMocks())

  it("renders the Reviews submenu with all six children and the open-cases badge", () => {
    render(<AdminSidebar role="admin" permissions={{}} />)

    expect(screen.getByText("Reviews")).toBeInTheDocument()

    // The Reviews sub-menu follows the same collapsed-by-default,
    // user-toggled pattern as the existing Configuration sub-menu (see
    // admin-sidebar-configuration.test.tsx's "no forced-open behavior"
    // case) — it does not auto-expand just because a child route is
    // active, so the toggle must be clicked before children are visible.
    fireEvent.click(screen.getByRole("button", { name: /^reviews$/i }))

    expect(screen.getByText("Overview")).toBeInTheDocument()
    expect(screen.getByText("Reputation cases")).toBeInTheDocument()
    expect(screen.getByText("Seller ratings")).toBeInTheDocument()
    expect(screen.getByText("Archived sellers")).toBeInTheDocument()
    expect(screen.getByText("Thresholds")).toBeInTheDocument()
    expect(screen.getByText("Audit log")).toBeInTheDocument()
    expect(screen.getByText("38")).toBeInTheDocument()
  })

  it("hides the section entirely for a role without the reviews permission", () => {
    render(<AdminSidebar role="internal" permissions={{}} />)
    expect(screen.queryByText("Reviews")).not.toBeInTheDocument()
  })
})
