import { afterEach, beforeEach, describe, it, expect, vi } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
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
})

describe("AdminSidebar Content group", () => {
  // Validates Content shows News & Articles (not a separate News link).
  it("shows News & Articles but not a separate News link under Content", () => {
    render(
      <AdminSidebar
        role="admin"
        permissions={{
          [FEATURE_KEYS.NEWS]: true,
          [FEATURE_KEYS.ARTICLES]: true,
        }}
      />,
    )

    expect(screen.getByRole("link", { name: "News & Articles" })).toHaveAttribute(
      "href",
      "/admin/articles",
    )
    expect(screen.queryByRole("link", { name: "News" })).not.toBeInTheDocument()
  })

  // Validates that granting NEWS permission alone does not reintroduce a News nav link.
  it("does not show News even when NEWS permission is granted", () => {
    render(
      <AdminSidebar
        role="internal"
        permissions={{ [FEATURE_KEYS.NEWS]: true }}
      />,
    )

    expect(screen.queryByRole("link", { name: "News" })).not.toBeInTheDocument()
  })
})
