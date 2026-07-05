import { afterEach, beforeEach, describe, it, expect, vi } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import { AdminSidebar } from "@/components/admin/AdminSidebar"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"

afterEach(cleanup)

let mockPathname = "/admin"

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}))
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: Record<string, unknown>) => <img {...(props as React.ImgHTMLAttributes<HTMLImageElement>)} />,
}))
vi.mock("@/features/chat/context/admin-chat-notification-context", () => ({
  useAdminChatNotifications: () => ({ totalUnread: 0 }),
}))

beforeEach(() => {
  mockPathname = "/admin"
  localStorage.clear()
})

const configToggle = () => screen.getByRole("button", { name: /configuration/i })

// NOTE: the sidebar's collapse store is module-level, so open/closed state
// carries across tests in this file. Every test that expands the sub-menu
// collapses it again before finishing so each test starts collapsed.

describe("AdminSidebar Configuration sub-menu", () => {
  // Validates the default state: the Configuration parent renders for admin
  // but starts collapsed, with no sub-links visible.
  it("renders Configuration collapsed by default", () => {
    render(<AdminSidebar role="admin" permissions={{}} />)
    expect(configToggle()).toBeInTheDocument()
    expect(configToggle()).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("link", { name: "Category" })).not.toBeInTheDocument()
  })

  // Validates the expand/collapse toggle: expanding reveals all five
  // sub-links with correct hrefs, collapsing hides them again.
  it("expands to show all Configuration links, then collapses", () => {
    render(<AdminSidebar role="admin" permissions={{}} />)

    fireEvent.click(configToggle())
    expect(configToggle()).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("link", { name: "Category" })).toHaveAttribute("href", "/admin/categories")
    expect(screen.getByRole("link", { name: "Laboratory" })).toHaveAttribute("href", "/admin/laboratory")
    expect(screen.getByRole("link", { name: "Origin" })).toHaveAttribute("href", "/admin/origin")
    expect(screen.getByRole("link", { name: "Seller Rating Tags" })).toHaveAttribute("href", "/admin/settings/rating-tags")
    expect(screen.getByRole("link", { name: "Precaution Tags" })).toHaveAttribute("href", "/admin/settings/precaution-tags")

    fireEvent.click(configToggle())
    expect(configToggle()).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("link", { name: "Category" })).not.toBeInTheDocument()
  })

  // Validates that the Configuration item hides entirely when the user can
  // see none of its children (non-admin with no feature permissions).
  it("hides Configuration for a non-admin with no permissions", () => {
    render(<AdminSidebar role="internal" permissions={{}} />)
    expect(screen.queryByRole("button", { name: /configuration/i })).not.toBeInTheDocument()
  })

  // Validates per-child RBAC filtering: only the permitted child renders
  // when expanded, and the admin-only Category link stays hidden.
  it("shows only permitted children for a non-admin", () => {
    render(<AdminSidebar role="internal" permissions={{ [FEATURE_KEYS.LABORATORY]: true }} />)

    fireEvent.click(configToggle())
    expect(screen.getByRole("link", { name: "Laboratory" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Category" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Origin" })).not.toBeInTheDocument()

    fireEvent.click(configToggle())
  })

  // Validates that the sub-menu remains user-collapsible even while a child
  // route is active (no forced-open behavior).
  it("can be collapsed while a child route is active", () => {
    mockPathname = "/admin/laboratory"
    render(<AdminSidebar role="admin" permissions={{}} />)

    fireEvent.click(configToggle())
    expect(screen.getByRole("link", { name: "Laboratory" })).toBeInTheDocument()

    fireEvent.click(configToggle())
    expect(configToggle()).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("link", { name: "Laboratory" })).not.toBeInTheDocument()
  })
})
