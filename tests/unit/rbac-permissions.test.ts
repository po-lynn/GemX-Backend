import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidateTag: vi.fn(),
}))

vi.mock("@/drizzle/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}))

vi.mock("@/drizzle/schema/rbac-schema", () => ({
  supervisorPermission: { featureKey: "feature_key", canAccess: "can_access" },
}))

vi.mock("drizzle-orm", () => ({
  sql: vi.fn((strings: TemplateStringsArray) => strings.join("")),
}))

const mockRows = [
  { featureKey: "products", canAccess: true },
  { featureKey: "news",     canAccess: true },
  { featureKey: "users",    canAccess: false },
]

describe("getSupervisorPermissions", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns Record<string, boolean> keyed by featureKey", async () => {
    const { db } = await import("@/drizzle/db")
    vi.mocked(db.select).mockReturnValue({ from: vi.fn().mockResolvedValue(mockRows) } as never)
    const { getSupervisorPermissions } = await import("@/features/rbac/db/permissions")
    const result = await getSupervisorPermissions()
    expect(result).toEqual({ products: true, news: true, users: false })
  })

  it("returns empty object when table is empty", async () => {
    const { db } = await import("@/drizzle/db")
    vi.mocked(db.select).mockReturnValue({ from: vi.fn().mockResolvedValue([]) } as never)
    const { getSupervisorPermissions } = await import("@/features/rbac/db/permissions")
    const result = await getSupervisorPermissions()
    expect(result).toEqual({})
  })
})

describe("checkSupervisorAccess", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns true when featureKey canAccess is true", async () => {
    const { db } = await import("@/drizzle/db")
    vi.mocked(db.select).mockReturnValue({ from: vi.fn().mockResolvedValue(mockRows) } as never)
    const { checkSupervisorAccess } = await import("@/features/rbac/db/permissions")
    expect(await checkSupervisorAccess("products")).toBe(true)
  })

  it("returns false for unknown featureKey", async () => {
    const { db } = await import("@/drizzle/db")
    vi.mocked(db.select).mockReturnValue({ from: vi.fn().mockResolvedValue(mockRows) } as never)
    const { checkSupervisorAccess } = await import("@/features/rbac/db/permissions")
    expect(await checkSupervisorAccess("settings.escrow")).toBe(false)
  })

  it("returns false when featureKey canAccess is false", async () => {
    const { db } = await import("@/drizzle/db")
    vi.mocked(db.select).mockReturnValue({ from: vi.fn().mockResolvedValue(mockRows) } as never)
    const { checkSupervisorAccess } = await import("@/features/rbac/db/permissions")
    expect(await checkSupervisorAccess("users")).toBe(false)
  })
})
