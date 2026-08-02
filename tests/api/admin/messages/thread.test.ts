import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock("@/features/rbac/db/permissions", () => ({ checkInternalAccess: vi.fn() }))
vi.mock("@/features/chat/db/admin-all-conversations", () => ({
  getConversationMessagesForAdmin: vi.fn(),
}))

const { auth } = await import("@/lib/auth")
const { checkInternalAccess } = await import("@/features/rbac/db/permissions")
const { getConversationMessagesForAdmin } = await import("@/features/chat/db/admin-all-conversations")
const { GET } = await import("@/app/api/admin/messages/thread/route")

function makeRequest(query: string): NextRequest {
  return new Request(`http://localhost/api/admin/messages/thread${query}`) as unknown as NextRequest
}

describe("GET /api/admin/messages/thread", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Validates the endpoint requires a session at all.
  it("returns 401 without a session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never)
    const res = await GET(makeRequest("?userA=a&userB=b"))
    expect(res.status).toBe(401)
    expect(getConversationMessagesForAdmin).not.toHaveBeenCalled()
  })

  // Validates the OR-permission gate: unlike the admin-only oversight endpoint this
  // reuses data from, internal staff holding EITHER messages OR chat_dashboard get in —
  // this is what keeps the merged Messages page working for staff who only ever had
  // the legacy chat_dashboard permission (see docs/technical/messages-triage.md).
  it("allows internal staff with only the messages permission", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "staff-1", role: "internal" } } as never)
    vi.mocked(checkInternalAccess).mockImplementation(async (_id, key) => key === "messages")
    vi.mocked(getConversationMessagesForAdmin).mockResolvedValue({ messages: [], total: 0 })

    const res = await GET(makeRequest("?userA=a&userB=b"))
    expect(res.status).toBe(200)
  })

  it("allows internal staff with only the legacy chat_dashboard permission", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "staff-2", role: "internal" } } as never)
    vi.mocked(checkInternalAccess).mockImplementation(async (_id, key) => key === "chat_dashboard")
    vi.mocked(getConversationMessagesForAdmin).mockResolvedValue({ messages: [], total: 0 })

    const res = await GET(makeRequest("?userA=a&userB=b"))
    expect(res.status).toBe(200)
  })

  it("returns 403 for internal staff with neither permission", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "staff-3", role: "internal" } } as never)
    vi.mocked(checkInternalAccess).mockResolvedValue(false)

    const res = await GET(makeRequest("?userA=a&userB=b"))
    expect(res.status).toBe(403)
    expect(getConversationMessagesForAdmin).not.toHaveBeenCalled()
  })

  // Validates the happy path for a true admin (no permission lookup needed).
  it("returns messages for role admin without a permission check", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "admin-1", role: "admin" } } as never)
    vi.mocked(getConversationMessagesForAdmin).mockResolvedValue({
      messages: [
        {
          id: "m1",
          senderId: "user-a",
          recipientId: "user-b",
          content: "hi",
          fileUrl: null,
          imageUrls: null,
          messageType: "text",
          createdAt: "2026-07-01T00:00:00.000Z",
          starred: false,
        },
      ],
      total: 1,
    })

    const res = await GET(makeRequest("?userA=user-a&userB=user-b&page=1&limit=100"))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.messages).toHaveLength(1)
    expect(checkInternalAccess).not.toHaveBeenCalled()
    expect(getConversationMessagesForAdmin).toHaveBeenCalledWith("user-a", "user-b", 1, 100)
  })

  // Validates the same-user guard rejects a degenerate pair before hitting the DB.
  it("returns 400 when userA equals userB", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "admin-1", role: "admin" } } as never)
    const res = await GET(makeRequest("?userA=same&userB=same"))
    expect(res.status).toBe(400)
    expect(getConversationMessagesForAdmin).not.toHaveBeenCalled()
  })
})
