import { afterEach, beforeEach, describe, it, expect, vi } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { AdminSidebar } from "@/components/admin/AdminSidebar"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"

afterEach(cleanup)

let mockPathname = "/admin"

vi.mock("next/navigation", () => ({ usePathname: () => mockPathname }))
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

describe("AdminSidebar System group", () => {
  it("shows a Queue link to admins", () => {
    render(<AdminSidebar role="admin" permissions={{}} />)
    expect(screen.getByRole("link", { name: "Queue" })).toHaveAttribute("href", "/admin/queue")
  })

  it("hides Queue from internal staff without the queue_management permission", () => {
    render(<AdminSidebar role="internal" permissions={{}} />)
    expect(screen.queryByRole("link", { name: "Queue" })).not.toBeInTheDocument()
  })

  it("shows Queue to internal staff granted the queue_management permission", () => {
    render(<AdminSidebar role="internal" permissions={{ [FEATURE_KEYS.QUEUE_MANAGEMENT]: true }} />)
    expect(screen.getByRole("link", { name: "Queue" })).toHaveAttribute("href", "/admin/queue")
  })
})
