import { describe, it, expect, vi, beforeEach } from "vitest"

// This used to use unstable_cache, which doesn't participate in Next's
// cacheComponents tag invalidation the same way "use cache" + cacheTag does —
// saved permission changes never actually took effect. Mock next/cache the
// same way tests/unit/products-cache-revalidate.test.ts does for the
// converted "use cache" cache module.
const { cacheTag, revalidateTag } = vi.hoisted(() => ({
  cacheTag: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock("next/cache", () => ({ cacheTag, revalidateTag }))

vi.mock("@/drizzle/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}))

vi.mock("@/drizzle/schema/rbac-schema", () => ({
  internalPermission: { userId: "user_id", featureKey: "feature_key", canAccess: "can_access" },
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

  it("tags the cache entry per-user so one user's revalidation can't affect another's", async () => {
    const { db } = await import("@/drizzle/db")
    vi.mocked(db.select).mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) } as never)
    const { getUserPermissions } = await import("@/features/rbac/db/permissions")
    await getUserPermissions("u1")
    expect(cacheTag).toHaveBeenCalledWith(expect.stringContaining("u1"))
  })
})

describe("checkInternalAccess", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns true when user has canAccess true for featureKey", async () => {
    const { db } = await import("@/drizzle/db")
    vi.mocked(db.select).mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(mockRows) }) } as never)
    const { checkInternalAccess } = await import("@/features/rbac/db/permissions")
    expect(await checkInternalAccess("u1", "products")).toBe(true)
  })

  it("returns false for unknown featureKey", async () => {
    const { db } = await import("@/drizzle/db")
    vi.mocked(db.select).mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(mockRows) }) } as never)
    const { checkInternalAccess } = await import("@/features/rbac/db/permissions")
    expect(await checkInternalAccess("u1", "settings.escrow")).toBe(false)
  })

  it("returns false when user has canAccess false for featureKey", async () => {
    const { db } = await import("@/drizzle/db")
    vi.mocked(db.select).mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(mockRows) }) } as never)
    const { checkInternalAccess } = await import("@/features/rbac/db/permissions")
    expect(await checkInternalAccess("u1", "users")).toBe(false)
  })
})

describe("setUserPermissions", () => {
  beforeEach(() => vi.clearAllMocks())

  // Regression test: revalidateTag must use the "max" profile like every
  // other cache in this codebase (see revalidateProductsCache) — using a
  // mismatched/no-op profile is what left saved permission changes stuck
  // behind the previously-cached snapshot.
  it("revalidates the user's permission tag with the 'max' profile after writing", async () => {
    const { db } = await import("@/drizzle/db")
    const insertChain = {
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      }),
    }
    vi.mocked(db.insert).mockReturnValue(insertChain as never)
    const { setUserPermissions } = await import("@/features/rbac/db/permissions")
    await setUserPermissions("u1", { messages: true })
    expect(revalidateTag).toHaveBeenCalledWith(expect.stringContaining("u1"), "max")
  })

  it("revalidates even when given an empty permissions object", async () => {
    const { setUserPermissions } = await import("@/features/rbac/db/permissions")
    await setUserPermissions("u1", {})
    expect(revalidateTag).toHaveBeenCalledWith(expect.stringContaining("u1"), "max")
  })
})
