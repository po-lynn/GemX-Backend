import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { auth } from "@/lib/auth"
import { getUserById } from "@/features/users/db/users"
import { getProductsBySellerId } from "@/features/products/db/products"
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
// Both GET /api/profile and GET /api/profile/[id] call getProductsBySellerId directly
// (features/products/db/products), not the cached wrapper in db/cache/products.
vi.mock("@/features/products/db/products", () => ({
  getProductsBySellerId: vi.fn(),
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
    vi.mocked(getProductsBySellerId).mockResolvedValue({
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
    vi.mocked(getProductsBySellerId).mockResolvedValue({
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

  // Primary: the profile record itself. A hung DB call must fail fast with a retryable
  // error instead of hanging until the platform kills the invocation.
  it("returns 503 with Retry-After when getUserById (primary) hangs past the timeout", async () => {
    vi.useFakeTimers()
    try {
      vi.mocked(getUserById).mockReturnValue(new Promise(() => {}))
      const req = new Request("http://localhost/api/profile/user-1")
      const resPromise = GETPublicProfile(req as NextRequest, {
        params: Promise.resolve({ id: "user-1" }),
      })
      await vi.advanceTimersByTimeAsync(6000)
      const res = await resPromise
      expect(res.status).toBe(503)
      expect(res.headers.get("Retry-After")).toBe("3")
      const data = await res.json()
      expect(data.error).toMatch(/retry/i)
    } finally {
      vi.useRealTimers()
    }
  })

  // Primary: the seller's product listings are the actual content of the profile page.
  it("returns 503 with Retry-After when getProductsBySellerId (primary) hangs past the timeout", async () => {
    vi.useFakeTimers()
    try {
      vi.mocked(getProductsBySellerId).mockReturnValue(new Promise(() => {}))
      const req = new Request("http://localhost/api/profile/user-1")
      const resPromise = GETPublicProfile(req as NextRequest, {
        params: Promise.resolve({ id: "user-1" }),
      })
      await vi.advanceTimersByTimeAsync(6000)
      const res = await resPromise
      expect(res.status).toBe(503)
      expect(res.headers.get("Retry-After")).toBe("3")
    } finally {
      vi.useRealTimers()
    }
  })

  // Secondary: presence is decorative. A hung presence lookup must not fail the whole
  // profile — it degrades to a fallback that stays distinguishable from a real "Offline".
  it("returns 200 with a distinguishable fallback when getPublicProfilePresence (secondary) hangs", async () => {
    vi.useFakeTimers()
    try {
      vi.mocked(getPublicProfilePresence).mockReturnValue(new Promise(() => {}))
      const req = new Request("http://localhost/api/profile/user-1")
      const resPromise = GETPublicProfile(req as NextRequest, {
        params: Promise.resolve({ id: "user-1" }),
      })
      await vi.advanceTimersByTimeAsync(7000)
      const res = await resPromise
      expect(res.status).toBe(200)
      const data = await res.json()
      // Primary content (products) still present despite the secondary hang.
      expect(data.products).toEqual({ products: [], total: 0 })
      expect(data.profile.presence).toBe("offline")
      expect(data.profile.status).toBe("Unknown")
    } finally {
      vi.useRealTimers()
    }
  })

  // Secondary: the premium-dealer badge is decorative. A rejected lookup must not fail
  // the whole profile — it degrades to `false`, which just hides the badge.
  it("returns 200 with isPremiumDealer=false when isUserActivePremiumDealer (secondary) rejects", async () => {
    vi.mocked(isUserActivePremiumDealer).mockRejectedValue(new Error("db boom"))
    const req = new Request("http://localhost/api/profile/user-1")
    const res = await GETPublicProfile(req as NextRequest, {
      params: Promise.resolve({ id: "user-1" }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.profile.isPremiumDealer).toBe(false)
    expect(data.products).toEqual({ products: [], total: 0 })
  })
})
