import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/drizzle/db"

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>()
  return { ...actual, eq: vi.fn(() => "eq") }
})

vi.mock("@/drizzle/schema", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/drizzle/schema")>()
  return { ...actual }
})

const mockValues = vi.fn().mockResolvedValue([])
const mockInsert = vi.fn(() => ({ values: mockValues }))

function makeUpdateChain() {
  const chain: Record<string, unknown> = {}
  chain.set = vi.fn(() => chain)
  chain.where = vi.fn().mockResolvedValue([])
  return chain
}

function makeSelectChain(result: unknown) {
  const chain: Record<string, unknown> = {}
  chain.from = vi.fn(() => chain)
  chain.where = vi.fn().mockResolvedValue(result)
  return chain
}

vi.mock("@/drizzle/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(db.insert).mockReturnValue({ values: mockValues } as ReturnType<typeof db.insert>)
})

describe("verifyProductInDb", () => {
  it("updates product with isVerified=true, verifiedAt, and verifiedBy", async () => {
    // Validates that the update sets the correct verification fields
    const updateChain = makeUpdateChain()
    vi.mocked(db.select).mockReturnValue(makeSelectChain([{ isVerified: false }]) as ReturnType<typeof db.select>)
    vi.mocked(db.update).mockReturnValue(updateChain as ReturnType<typeof db.update>)

    const { verifyProductInDb } = await import("@/features/products/db/products")
    await verifyProductInDb("prod-1", "admin-1")

    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ isVerified: true, verifiedBy: "admin-1" })
    )
  })

  it("inserts a verified change log entry with oldValue false and newValue true", async () => {
    // Validates that a change log entry is written with the correct type and values
    const updateChain = makeUpdateChain()
    vi.mocked(db.select).mockReturnValue(makeSelectChain([{ isVerified: false }]) as ReturnType<typeof db.select>)
    vi.mocked(db.update).mockReturnValue(updateChain as ReturnType<typeof db.update>)

    const { verifyProductInDb } = await import("@/features/products/db/products")
    await verifyProductInDb("prod-1", "admin-1")

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ changeType: "verified", oldValue: "false", newValue: "true", actorId: "admin-1" })
    )
  })
})

describe("unverifyProductInDb", () => {
  it("clears isVerified, verifiedAt, and verifiedBy when product was verified", async () => {
    // Validates that all three verification fields are cleared when the product was previously verified
    const updateChain = makeUpdateChain()
    vi.mocked(db.select).mockReturnValue(makeSelectChain([{ isVerified: true }]) as ReturnType<typeof db.select>)
    vi.mocked(db.update).mockReturnValue(updateChain as ReturnType<typeof db.update>)

    const { unverifyProductInDb } = await import("@/features/products/db/products")
    await unverifyProductInDb("prod-1", "admin-1")

    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ isVerified: false, verifiedAt: null, verifiedBy: null })
    )
  })

  it("skips update when product is already unverified", async () => {
    // Validates that no DB write occurs when the product is already unverified (idempotent)
    vi.mocked(db.select).mockReturnValue(makeSelectChain([{ isVerified: false }]) as ReturnType<typeof db.select>)

    const { unverifyProductInDb } = await import("@/features/products/db/products")
    await unverifyProductInDb("prod-1", "admin-1")

    expect(db.update).not.toHaveBeenCalled()
  })

  it("inserts a verified change log entry with oldValue true and newValue false", async () => {
    // Validates that the change log records the transition from verified to unverified
    const updateChain = makeUpdateChain()
    vi.mocked(db.select).mockReturnValue(makeSelectChain([{ isVerified: true }]) as ReturnType<typeof db.select>)
    vi.mocked(db.update).mockReturnValue(updateChain as ReturnType<typeof db.update>)

    const { unverifyProductInDb } = await import("@/features/products/db/products")
    await unverifyProductInDb("prod-1", "admin-1")

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ changeType: "verified", oldValue: "true", newValue: "false" })
    )
  })
})
