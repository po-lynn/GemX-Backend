import { beforeEach, describe, expect, it, vi } from "vitest"
import { connection } from "next/server"
import { getPublicRatingTags } from "@/features/rating-tags/db/rating-tags"
import { GET } from "@/app/api/rating-tags/route"

vi.mock("next/server", () => ({
  connection: vi.fn(),
}))
vi.mock("@/features/rating-tags/db/rating-tags", () => ({
  getPublicRatingTags: vi.fn(),
}))

describe("GET /api/rating-tags", () => {
  beforeEach(() => {
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(getPublicRatingTags).mockResolvedValue([])
  })

  it("returns 200 and ratingTags wrapper", async () => {
    const tags = [
      { id: "t1", name: "Fast shipping", type: "positive" as const },
      { id: "t3", name: "As described", type: "neutral" as const },
      { id: "t2", name: "Slow reply", type: "negative" as const },
    ]
    vi.mocked(getPublicRatingTags).mockResolvedValue(tags)
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ ratingTags: tags })
    expect(getPublicRatingTags).toHaveBeenCalled()
  })

  it("returns 500 when db throws", async () => {
    vi.mocked(getPublicRatingTags).mockRejectedValue(new Error("DB error"))
    const res = await GET()
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data).toEqual({ error: "Failed to load rating tags" })
  })
})
