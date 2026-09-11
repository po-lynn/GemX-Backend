import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { GET as getBuying } from "@/app/api/mobile/buying-guide/route"
import { GET as getSelling } from "@/app/api/mobile/selling-guide/route"
import {
  getCachedPublishedBuyingGuide,
  getCachedPublishedSellingGuide,
} from "@/features/app-content/db/cache/app-content"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/features/app-content/db/cache/app-content", () => ({
  getCachedPublishedBuyingGuide: vi.fn(),
  getCachedPublishedSellingGuide: vi.fn(),
}))

const PUBLISHED = {
  contentEn: '[{"type":"paragraph","content":[{"type":"text","text":"EN"}]}]',
  contentMy: '[{"type":"paragraph","content":[{"type":"text","text":"MY"}]}]',
  contentTh: '[{"type":"paragraph","content":[{"type":"text","text":"TH"}]}]',
  contentKo: '[{"type":"paragraph","content":[{"type":"text","text":"KO"}]}]',
  sourceLanguage: "English" as const,
}

describe("GET /api/mobile/buying-guide", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(getCachedPublishedBuyingGuide).mockResolvedValue(PUBLISHED)
  })

  it("returns published BlockNote JSON", async () => {
    const req = new Request("http://localhost/api/mobile/buying-guide")
    const res = await getBuying(req as NextRequest)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.contentEn).toContain("EN")
    expect(body.content).toContain("EN")
  })

  it("remaps content when lang=Thai", async () => {
    const req = new Request("http://localhost/api/mobile/buying-guide?lang=Thai")
    const res = await getBuying(req as NextRequest)
    const body = await res.json()
    expect(body.content).toContain("TH")
    expect(body.lang).toBe("Thai")
  })
})

describe("GET /api/mobile/selling-guide", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(getCachedPublishedSellingGuide).mockResolvedValue(PUBLISHED)
  })

  it("returns published BlockNote JSON", async () => {
    const req = new Request("http://localhost/api/mobile/selling-guide")
    const res = await getSelling(req as NextRequest)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.contentKo).toContain("KO")
  })
})
