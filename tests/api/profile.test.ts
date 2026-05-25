import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { auth } from "@/lib/auth"
import { getUserById } from "@/features/users/db/users"
import { getCachedProductsBySellerId } from "@/features/products/db/cache/products"
import { isUserActivePremiumDealer } from "@/features/points/db/points"
import { GET } from "@/app/api/profile/route"
import { GET as GETPublicProfile } from "@/app/api/profile/[id]/route"
import { getPublicProfilePresence } from "@/features/users/db/profile-presence"

vi.mock("next/server", () => ({
  connection: vi.fn(),
}))
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}))
vi.mock("@/features/users/db/users", () => ({
  getUserById: vi.fn(),
}))
vi.mock("@/features/products/db/cache/products", () => ({
  getCachedProductsBySellerId: vi.fn(),
}))
vi.mock("@/features/points/db/points", () => ({
  isUserActivePremiumDealer: vi.fn(),
}))
vi.mock("@/features/users/db/profile-presence", () => ({
  getPublicProfilePresence: vi.fn(),
}))

const mockUser = {
  id: "user-1",
  name: "Jane",
  email: "jane@example.com",
  role: "mobile",
  phone: "+959123456789",
  gender: null,
  dateOfBirth: null,
  points: 10,
  emailVerified: true,
  verified: true,
  archived: false,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  image: null,
  username: "959123456789",
  displayUsername: "Jane",
  nrc: null,
  address: null,
  city: null,
  state: null,
  country: null,
}

describe("GET /api/profile", () => {
  beforeEach(() => {
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1" },
    } as never)
    vi.mocked(getUserById).mockResolvedValue(mockUser)
    vi.mocked(getCachedProductsBySellerId).mockResolvedValue({
      products: [],
      total: 0,
    })
    vi.mocked(isUserActivePremiumDealer).mockResolvedValue(false)
  })

  it("returns profile.verified from the user row", async () => {
    const req = new Request("http://localhost/api/profile")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.profile.verified).toBe(true)
    expect(data.profile.emailVerified).toBe(true)
  })

  it("returns 401 when session is missing", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
    const req = new Request("http://localhost/api/profile")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(401)
  })
})

describe("GET /api/profile/:id", () => {
  beforeEach(() => {
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(getUserById).mockResolvedValue(mockUser)
    vi.mocked(getCachedProductsBySellerId).mockResolvedValue({
      products: [],
      total: 0,
    })
    vi.mocked(isUserActivePremiumDealer).mockResolvedValue(false)
    vi.mocked(getPublicProfilePresence).mockResolvedValue({
      presence: "offline",
      status: "Offline",
      lastSeenAt: null,
    })
  })

  it("returns profile.verified from the seller user row", async () => {
    const req = new Request("http://localhost/api/profile/user-1")
    const res = await GETPublicProfile(req as NextRequest, {
      params: Promise.resolve({ id: "user-1" }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.profile.verified).toBe(true)
    expect(data.profile.id).toBe("user-1")
  })

  it("returns 404 when seller is archived", async () => {
    vi.mocked(getUserById).mockResolvedValue({ ...mockUser, archived: true })
    const req = new Request("http://localhost/api/profile/user-1")
    const res = await GETPublicProfile(req as NextRequest, {
      params: Promise.resolve({ id: "user-1" }),
    })
    expect(res.status).toBe(404)
  })
})
