import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { GET } from "@/app/api/mobile/about-us/route"
import { getCachedPublishedAboutUs } from "@/features/app-content/db/cache/app-content"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/features/app-content/db/cache/app-content", () => ({
  getCachedPublishedAboutUs: vi.fn(),
}))

describe("GET /api/mobile/about-us", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
  })

  it("returns the published about-us content with cache headers", async () => {
    vi.mocked(getCachedPublishedAboutUs).mockResolvedValue({
      storyHeading: "Our Story",
      storyBody: "GemX began in 2019.",
      termsSlug: "terms",
      termsUpdatedAt: null,
      privacySlug: "privacy",
      privacyUpdatedAt: null,
      companyName: "GemX Technologies Ltd.",
      contactAddress: "Yangon, Myanmar",
      appVersion: "v2.4.1",
    })
    const req = new Request("http://localhost/api/mobile/about-us")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(200)
    expect(res.headers.get("Cache-Control")).toContain("public")
    const body = await res.json()
    expect(body).toMatchObject({ storyHeading: "Our Story", companyName: "GemX Technologies Ltd." })
  })

  it("returns 500 when the db layer throws", async () => {
    vi.mocked(getCachedPublishedAboutUs).mockRejectedValue(new Error("db down"))
    const req = new Request("http://localhost/api/mobile/about-us")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(500)
  })
})
