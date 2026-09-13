import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { GET } from "@/app/api/mobile/privacy-policy/route"
import { getCachedPublishedPrivacyPolicy } from "@/features/app-content/db/cache/app-content"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/features/app-content/db/cache/app-content", () => ({
  getCachedPublishedPrivacyPolicy: vi.fn(),
}))

const PUBLISHED = {
  contentEn: '[{"type":"paragraph","content":[{"type":"text","text":"EN"}]}]',
  contentMy: '[{"type":"paragraph","content":[{"type":"text","text":"MY"}]}]',
  contentTh: '[{"type":"paragraph","content":[{"type":"text","text":"TH"}]}]',
  contentKo: '[{"type":"paragraph","content":[{"type":"text","text":"KO"}]}]',
  sourceLanguage: "English" as const,
}

describe("GET /api/mobile/privacy-policy", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(getCachedPublishedPrivacyPolicy).mockResolvedValue(PUBLISHED)
  })

  it("returns published BlockNote JSON for all locales", async () => {
    const req = new Request("http://localhost/api/mobile/privacy-policy")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.contentEn).toContain("EN")
    expect(body.content).toContain("EN")
  })

  it("remaps content when lang=Korean", async () => {
    const req = new Request("http://localhost/api/mobile/privacy-policy?lang=Korean")
    const res = await GET(req as NextRequest)
    const body = await res.json()
    expect(body.content).toContain("KO")
    expect(body.lang).toBe("Korean")
  })
})
