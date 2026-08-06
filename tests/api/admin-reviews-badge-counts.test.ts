import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock("@/features/rbac/db/permissions", () => ({ checkInternalAccess: vi.fn() }))
vi.mock("@/features/reviews/db/reputation-cases", () => ({
  getReputationBadgeCounts: vi.fn(),
}))

const { auth } = await import("@/lib/auth")
const { checkInternalAccess } = await import("@/features/rbac/db/permissions")
const { getReputationBadgeCounts } = await import("@/features/reviews/db/reputation-cases")
const { GET } = await import("@/app/api/admin/reviews/badge-counts/route")

function makeRequest(): NextRequest {
  return new Request("http://localhost/api/admin/reviews/badge-counts") as unknown as NextRequest
}

describe("GET /api/admin/reviews/badge-counts", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 without a session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it("returns 403 for internal staff without the reviews permission", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "staff-1", role: "internal" } } as never)
    vi.mocked(checkInternalAccess).mockResolvedValue(false)
    const res = await GET(makeRequest())
    expect(res.status).toBe(403)
  })

  it("returns counts for an admin", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "admin-1", role: "admin" } } as never)
    vi.mocked(getReputationBadgeCounts).mockResolvedValue({ openCases: 38, archivedSellers: 29 })
    const res = await GET(makeRequest())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json).toEqual({ openCases: 38, archivedSellers: 29 })
  })
})
