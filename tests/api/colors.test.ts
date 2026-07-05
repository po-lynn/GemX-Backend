import { describe, it, expect, vi, beforeEach } from "vitest"
import { connection } from "next/server"
import { getAllColors } from "@/features/colors/db/color"
import { GET } from "@/app/api/colors/route"

vi.mock("next/server", () => ({
  connection: vi.fn(),
}))
vi.mock("@/features/colors/db/color", () => ({
  getAllColors: vi.fn(),
}))

describe("GET /api/colors", () => {
  beforeEach(() => {
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(getAllColors).mockResolvedValue([])
  })

  // Validates the happy path: rows come back as {id, name, hexCode} only —
  // timestamps are stripped from the public payload.
  it("returns 200 with id, name and hexCode per colour", async () => {
    vi.mocked(getAllColors).mockResolvedValue([
      { id: "c1", name: "Blue", hexCode: "#1565C0", createdAt: new Date(), updatedAt: new Date() },
      { id: "c2", name: "Multi-color", hexCode: "", createdAt: new Date(), updatedAt: new Date() },
    ] as never)
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual([
      { id: "c1", name: "Blue", hexCode: "#1565C0" },
      { id: "c2", name: "Multi-color", hexCode: "" },
    ])
  })

  // Validates the empty state: no colours → empty array, still 200.
  it("returns an empty array when no colours exist", async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  // Validates the error state: db failure → 500 with the standard error envelope.
  it("returns 500 when the db throws", async () => {
    vi.mocked(getAllColors).mockRejectedValue(new Error("DB error"))
    const res = await GET()
    expect(res.status).toBe(500)
    expect(await res.json()).toHaveProperty("error", "Failed to fetch colors")
  })
})
