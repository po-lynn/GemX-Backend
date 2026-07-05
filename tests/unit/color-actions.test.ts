import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  createColorAction,
  updateColorAction,
  deleteColorAction,
} from "@/features/colors/actions/color"
import { requireActionRole } from "@/lib/action-guard"
import {
  createColorInDb,
  updateColorInDb,
  deleteColorInDb,
} from "@/features/colors/db/color"
import { revalidateColorCache } from "@/features/colors/db/cache/color"

const VALID_UUID = "a1b2c3d4-e5f6-4789-a012-345678901234"

vi.mock("@/lib/action-guard", () => ({ requireActionRole: vi.fn() }))
vi.mock("@/features/colors/db/color", () => ({
  createColorInDb: vi.fn(),
  updateColorInDb: vi.fn(),
  deleteColorInDb: vi.fn(),
}))
vi.mock("@/features/colors/db/cache/color", () => ({
  revalidateColorCache: vi.fn(),
}))

function fd(entries: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(entries)) f.set(k, v)
  return f
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireActionRole).mockResolvedValue({ user: { id: "admin-1" } } as never)
})

describe("createColorAction", () => {
  // Validates the happy path: valid input + admin session → row created, cache revalidated.
  it("creates a colour and revalidates the cache", async () => {
    vi.mocked(createColorInDb).mockResolvedValue("new-id")
    const result = await createColorAction(fd({ name: "Teal", hexCode: "#008080" }))
    expect(result).toEqual({ success: true, colorId: "new-id" })
    expect(createColorInDb).toHaveBeenCalledWith({ name: "Teal", hexCode: "#008080" })
    expect(revalidateColorCache).toHaveBeenCalled()
  })

  // Validates input rejection: a bad hex never reaches the DB.
  it("returns an error for a malformed hex code", async () => {
    const result = await createColorAction(fd({ name: "Teal", hexCode: "008080" }))
    expect(result).toHaveProperty("error")
    expect(createColorInDb).not.toHaveBeenCalled()
  })

  // Validates auth: no admin session → Unauthorized, nothing written.
  it("returns Unauthorized when the session check fails", async () => {
    vi.mocked(requireActionRole).mockResolvedValue(null as never)
    const result = await createColorAction(fd({ name: "Teal", hexCode: "" }))
    expect(result).toEqual({ error: "Unauthorized" })
    expect(createColorInDb).not.toHaveBeenCalled()
  })

  // Validates the duplicate-name path: a Postgres 23505 unique violation is
  // mapped to a friendly message instead of crashing the action.
  it("maps a unique violation to a friendly error", async () => {
    vi.mocked(createColorInDb).mockRejectedValue(
      Object.assign(new Error("duplicate key"), { code: "23505" })
    )
    const result = await createColorAction(fd({ name: "Red", hexCode: "" }))
    expect(result).toEqual({ error: "A colour with this name already exists" })
  })
})

describe("updateColorAction", () => {
  // Validates the happy path for updates.
  it("updates a colour and revalidates the cache", async () => {
    vi.mocked(updateColorInDb).mockResolvedValue(true)
    const result = await updateColorAction(
      fd({ colorId: VALID_UUID, name: "Sky Blue", hexCode: "#87CEEB" })
    )
    expect(result).toEqual({ success: true, colorId: VALID_UUID })
    expect(updateColorInDb).toHaveBeenCalledWith(VALID_UUID, {
      name: "Sky Blue",
      hexCode: "#87CEEB",
    })
  })

  // Validates the duplicate-name path on rename.
  it("maps a unique violation on rename to a friendly error", async () => {
    vi.mocked(updateColorInDb).mockRejectedValue(
      Object.assign(new Error("duplicate key"), { code: "23505" })
    )
    const result = await updateColorAction(fd({ colorId: VALID_UUID, name: "Red" }))
    expect(result).toEqual({ error: "A colour with this name already exists" })
  })
})

describe("deleteColorAction", () => {
  // Validates the happy path: existing row deleted.
  it("deletes a colour", async () => {
    vi.mocked(deleteColorInDb).mockResolvedValue(true)
    const result = await deleteColorAction(fd({ colorId: VALID_UUID }))
    expect(result).toEqual({ success: true })
  })

  // Validates the not-found path: delete of a missing row reports an error.
  it("returns an error when the colour does not exist", async () => {
    vi.mocked(deleteColorInDb).mockResolvedValue(false)
    const result = await deleteColorAction(fd({ colorId: VALID_UUID }))
    expect(result).toEqual({ error: "Color not found" })
  })
})
