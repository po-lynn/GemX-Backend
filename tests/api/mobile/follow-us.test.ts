import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { GET } from "@/app/api/mobile/follow-us/route"
import { getCachedPublishedFollowUs } from "@/features/app-content/db/cache/app-content"
import type { SocialPlatform } from "@/features/app-content/schemas/app-content"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/features/app-content/db/cache/app-content", () => ({
  getCachedPublishedFollowUs: vi.fn(),
}))

const PLATFORM_ACTIVE = {
  id: "p1",
  iconKey: "facebook",
  customIconUrl: null,
  label: "Facebook",
  value: "facebook.com/gemx.app",
  url: "https://facebook.com/gemx.app",
  isActive: true,
  sortOrder: 1,
} satisfies SocialPlatform
const PLATFORM_HIDDEN = {
  id: "p2",
  iconKey: "tiktok",
  customIconUrl: null,
  label: "TikTok",
  value: "@gemx",
  url: "https://tiktok.com/@gemx",
  isActive: false,
  sortOrder: 0,
} satisfies SocialPlatform

describe("GET /api/mobile/follow-us", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
  })

  it("returns only active platforms, sorted by sortOrder", async () => {
    vi.mocked(getCachedPublishedFollowUs).mockResolvedValue({
      platforms: [PLATFORM_ACTIVE, PLATFORM_HIDDEN],
    })
    const req = new Request("http://localhost/api/mobile/follow-us")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.platforms).toHaveLength(1)
    expect(body.platforms[0]).toMatchObject({ label: "Facebook" })
  })

  it("returns an empty list when never published", async () => {
    vi.mocked(getCachedPublishedFollowUs).mockResolvedValue({ platforms: [] })
    const req = new Request("http://localhost/api/mobile/follow-us")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(200)
    expect((await res.json()).platforms).toEqual([])
  })
})
