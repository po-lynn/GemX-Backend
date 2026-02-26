import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { getCategoriesByType, getAllCategories } from "@/features/categories/db/categories"
import { GET } from "@/app/api/categories/route"

vi.mock("next/server", () => ({
  connection: vi.fn(),
}))
vi.mock("@/features/categories/db/categories", () => ({
  getCategoriesByType: vi.fn(),
  getAllCategories: vi.fn(),
}))

describe("GET /api/categories", () => {
  beforeEach(() => {
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(getCategoriesByType).mockResolvedValue([])
    vi.mocked(getAllCategories).mockResolvedValue([])
  })

  it("returns 200 and categories when type is loose_stone", async () => {
    const categories = [{ id: "cat-1", name: "Ruby", type: "loose_stone" }]
    vi.mocked(getCategoriesByType).mockResolvedValue(categories as never)
    const req = new Request("http://localhost/api/categories?type=loose_stone")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual(categories)
    expect(getCategoriesByType).toHaveBeenCalledWith("loose_stone")
  })

  it("returns 200 and categories when type is jewellery", async () => {
    const categories = [{ id: "cat-2", name: "Ring", type: "jewellery" }]
    vi.mocked(getCategoriesByType).mockResolvedValue(categories as never)
    const req = new Request("http://localhost/api/categories?type=jewellery")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual(categories)
    expect(getCategoriesByType).toHaveBeenCalledWith("jewellery")
  })

  it("returns all categories when type is missing or invalid", async () => {
    const categories = [{ id: "a", name: "All" }]
    vi.mocked(getAllCategories).mockResolvedValue(categories as never)
    const req = new Request("http://localhost/api/categories")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual(categories)
    expect(getAllCategories).toHaveBeenCalled()
  })

  it("returns 500 and error message when db throws", async () => {
    vi.mocked(getAllCategories).mockRejectedValue(new Error("DB error"))
    const req = new Request("http://localhost/api/categories")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data).toHaveProperty("error", "Failed to fetch categories")
  })
})
