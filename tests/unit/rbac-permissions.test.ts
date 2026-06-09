import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("next/cache", () => ({
  unstable_cache: (_fn: unknown, _key: unknown, _opts: unknown) => _fn,
  revalidateTag: vi.fn(),
}))

vi.mock("@/drizzle/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}))

vi.mock("@/drizzle/schema/rbac-schema", () => ({
  supervisorPermission: { userId: "user_id", featureKey: "feature_key", canAccess: "can_access" },
}))

vi.mock("drizzle-orm", () => ({
  sql: vi.fn((strings: TemplateStringsArray) => strings.join("")),
  eq: vi.fn(),
}))

const mockRows = [
  { featureKey: "products", canAccess: true },
  { featureKey: "news",     canAccess: true },
  { featureKey: "users",    canAccess: false },
]

describe("getUserPermissions", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns Record<string, boolean> keyed by featureKey for a user", async () => {
    const { db } = await import("@/drizzle/db")
    vi.mocked(db.select).mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(mockRows) }) } as never)
    const { getUserPermissions } = await import("@/features/rbac/db/permissions")
    const result = await getUserPermissions("u1")
    expect(result).toEqual({ products: true, news: true, users: false })
  })

  it("returns empty object when user has no permissions", async () => {
    const { db } = await import("@/drizzle/db")
    vi.mocked(db.select).mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) } as never)
    const { getUserPermissions } = await import("@/features/rbac/db/permissions")
    const result = await getUserPermissions("u1")
    expect(result).toEqual({})
  })
})

describe("checkSupervisorAccess", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns true when user has canAccess true for featureKey", async () => {
    const { db } = await import("@/drizzle/db")
    vi.mocked(db.select).mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(mockRows) }) } as never)
    const { checkSupervisorAccess } = await import("@/features/rbac/db/permissions")
    expect(await checkSupervisorAccess("u1", "products")).toBe(true)
  })

  it("returns false for unknown featureKey", async () => {
    const { db } = await import("@/drizzle/db")
    vi.mocked(db.select).mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(mockRows) }) } as never)
    const { checkSupervisorAccess } = await import("@/features/rbac/db/permissions")
    expect(await checkSupervisorAccess("u1", "settings.escrow")).toBe(false)
  })

  it("returns false when user has canAccess false for featureKey", async () => {
    const { db } = await import("@/drizzle/db")
    vi.mocked(db.select).mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(mockRows) }) } as never)
    const { checkSupervisorAccess } = await import("@/features/rbac/db/permissions")
    expect(await checkSupervisorAccess("u1", "users")).toBe(false)
  })
})
