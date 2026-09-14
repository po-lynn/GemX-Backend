import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { GET } from "@/app/api/mobile/about-us/route"
import { getCachedPublishedAboutUs } from "@/features/app-content/db/cache/app-content"
import { DEFAULT_ABOUT_US_CONTENT } from "@/features/app-content/db/app-content"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/features/app-content/db/cache/app-content", () => ({
  getCachedPublishedAboutUs: vi.fn(),
}))

const PUBLISHED = {
  ...DEFAULT_ABOUT_US_CONTENT,
  storyHeadingEn: "Our Story",
  storyHeadingMy: "ကျွန်ုပ်တို့၏ဇာတ်လမ်း",
  storyBodyEn: "GemX began in 2019.",
  storyBodyMy: "GemX သည် ၂၀၁၉ တွင် စတင်ခဲ့သည်။",
  companyNameEn: "GemX Technologies Ltd.",
  companyNameMy: "GemX နည်းပညာ",
  contactAddressEn: "Yangon, Myanmar",
  contactAddressMy: "ရန်ကုန်၊ မြန်မာ",
  appVersion: "v2.4.1",
}

describe("GET /api/mobile/about-us", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
  })

  // Default response uses English fields mapped onto storyHeading / storyBody / etc.
  it("returns the published about-us content with cache headers", async () => {
    vi.mocked(getCachedPublishedAboutUs).mockResolvedValue(PUBLISHED)
    const req = new Request("http://localhost/api/mobile/about-us")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(200)
    expect(res.headers.get("Cache-Control")).toContain("public")
    const body = await res.json()
    expect(body).toMatchObject({
      storyHeading: "Our Story",
      companyName: "GemX Technologies Ltd.",
      storyHeadingEn: "Our Story",
      lang: null,
    })
  })

  // ?lang=Myanmar remaps the four localized fields to the Myanmar locale.
  it("localizes story and company fields when lang=Myanmar", async () => {
    vi.mocked(getCachedPublishedAboutUs).mockResolvedValue(PUBLISHED)
    const req = new Request("http://localhost/api/mobile/about-us?lang=Myanmar")
    const res = await GET(req as NextRequest)
    const body = await res.json()
    expect(body).toMatchObject({
      storyHeading: "ကျွန်ုပ်တို့၏ဇာတ်လမ်း",
      storyBody: "GemX သည် ၂၀၁၉ တွင် စတင်ခဲ့သည်။",
      companyName: "GemX နည်းပညာ",
      contactAddress: "ရန်ကုန်၊ မြန်မာ",
      lang: "Myanmar",
    })
  })

  it("returns 500 when the db layer throws", async () => {
    vi.mocked(getCachedPublishedAboutUs).mockRejectedValue(new Error("db down"))
    const req = new Request("http://localhost/api/mobile/about-us")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(500)
  })
})
