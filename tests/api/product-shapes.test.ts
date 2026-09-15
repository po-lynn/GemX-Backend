import { beforeEach, describe, expect, it, vi } from "vitest"
import { connection } from "next/server"
import { GET } from "@/app/api/product-shapes/route"
import { getAllProductShapes } from "@/features/product-shape/db/product-shape"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/features/product-shape/db/product-shape", () => ({
  getAllProductShapes: vi.fn(),
}))

describe("GET /api/product-shapes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
  })

  // Happy path: public list with cache headers for product forms / mobile.
  it("returns product shapes with cache headers", async () => {
    vi.mocked(getAllProductShapes).mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000001",
        name: "Oval",
        createdAt: new Date("2026-09-14T00:00:00.000Z"),
        updatedAt: new Date("2026-09-14T00:00:00.000Z"),
      },
    ])
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get("Cache-Control")).toContain("public")
    const body = await res.json()
    expect(body).toEqual([
      expect.objectContaining({ id: "00000000-0000-4000-8000-000000000001", name: "Oval" }),
    ])
  })

  it("returns 500 when the db layer throws", async () => {
    vi.mocked(getAllProductShapes).mockRejectedValue(new Error("db down"))
    const res = await GET()
    expect(res.status).toBe(500)
  })
})
