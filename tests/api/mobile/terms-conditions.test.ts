import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { GET } from "@/app/api/mobile/terms-conditions/route"
import { getCachedPublishedTermsConditions } from "@/features/app-content/db/cache/app-content"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/features/app-content/db/cache/app-content", () => ({
  getCachedPublishedTermsConditions: vi.fn(),
}))

const PUBLISHED = {
  contentEn: '[{"type":"paragraph","content":[{"type":"text","text":"EN"}]}]',
  contentMy: '[{"type":"paragraph","content":[{"type":"text","text":"MY"}]}]',
  contentTh: '[{"type":"paragraph","content":[{"type":"text","text":"TH"}]}]',
  contentKo: '[{"type":"paragraph","content":[{"type":"text","text":"KO"}]}]',
  sourceLanguage: "English" as const,
}

describe("GET /api/mobile/terms-conditions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(getCachedPublishedTermsConditions).mockResolvedValue(PUBLISHED)
  })

  // Happy path: returns all locales plus English as default content.
  it("returns published BlockNote JSON for all locales", async () => {
    const req = new Request("http://localhost/api/mobile/terms-conditions")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.contentEn).toContain("EN")
    expect(body.contentMy).toContain("MY")
    expect(body.content).toContain("EN")
    expect(body.sourceLanguage).toBe("English")
  })

  // Validates ?lang= remaps the primary content field for the mobile client.
  it("remaps content when lang=Myanmar", async () => {
    const req = new Request("http://localhost/api/mobile/terms-conditions?lang=Myanmar")
    const res = await GET(req as NextRequest)
    const body = await res.json()
    expect(body.content).toContain("MY")
    expect(body.lang).toBe("Myanmar")
  })
})
