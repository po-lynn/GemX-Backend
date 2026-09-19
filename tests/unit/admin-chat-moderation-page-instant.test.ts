import { describe, it, expect, vi, beforeEach } from "vitest"
import { connection } from "next/server"
import { requireChatModerationAccess } from "@/features/chat-moderation/lib/require-chat-moderation-access"
import AdminChatModerationPage, { instant } from "@/app/admin/messages/moderation/page"

// Regression test for the "uncached data accessed outside Suspense" prerendering error:
// this page's access check reads the signed-in session on every load (via
// requireChatModerationAccess -> auth.api.getSession), so it can never join a static
// shell. It needs both `await connection()` and `export const instant = false`, the same
// opt-out used by app/admin/messages/escrow/page.tsx and app/admin/messages/page.tsx.

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/features/chat-moderation/lib/require-chat-moderation-access", () => ({
  requireChatModerationAccess: vi.fn(),
}))
vi.mock("@/features/chat-moderation/components/ChatModerationDashboard", () => ({
  ChatModerationDashboard: () => null,
}))
vi.mock("@/components/admin/motion", () => ({
  FadeUp: ({ children }: { children: React.ReactNode }) => children,
}))

describe("AdminChatModerationPage instant navigation opt-out", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(requireChatModerationAccess).mockResolvedValue({ user: { id: "admin-1" } } as never)
  })

  it("exports instant = false so validation doesn't flag this always-dynamic route", () => {
    expect(instant).toBe(false)
  })

  it("awaits connection() before the session-dependent access check", async () => {
    const order: string[] = []
    vi.mocked(connection).mockImplementation(async () => {
      order.push("connection")
    })
    vi.mocked(requireChatModerationAccess).mockImplementation(async () => {
      order.push("access-check")
      return { user: { id: "admin-1" } } as never
    })

    await AdminChatModerationPage()
    expect(order).toEqual(["connection", "access-check"])
  })
})
