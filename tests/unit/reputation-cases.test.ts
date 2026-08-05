import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("drizzle-orm", () => ({
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
    { raw: (s: string) => s }
  ),
  eq: vi.fn(() => "eq"),
  inArray: vi.fn(() => "inArray"),
  desc: vi.fn((x: unknown) => x),
}))

vi.mock("@/drizzle/schema/auth-schema", () => ({
  user: { id: "id", name: "name", image: "image", premiumDealerExpiresAt: "premium_dealer_expires_at" },
}))
vi.mock("@/drizzle/schema/seller-rating-schema", () => ({
  sellerRating: {
    id: "id", raterUserId: "rater_user_id", sellerUserId: "seller_user_id",
    score: "score", comment: "comment", createdAt: "created_at",
  },
}))
vi.mock("@/drizzle/schema/rating-tag-schema", () => ({
  ratingTag: { id: "id", name: "name", type: "type" },
}))
vi.mock("@/drizzle/schema/rating-tag-map-schema", () => ({
  ratingTagMap: { id: "id", ratingId: "rating_id", tagId: "tag_id" },
}))
vi.mock("@/drizzle/schema/reputation-schema", () => ({
  sellerReputationAction: {
    id: "id", sellerUserId: "seller_user_id", actionType: "action_type",
    triggerKey: "trigger_key", reason: "reason", adminUserId: "admin_user_id", createdAt: "created_at",
  },
  sellerArchive: { id: "id", sellerUserId: "seller_user_id", restoredAt: "restored_at" },
}))
vi.mock("@/drizzle/schema/product-schema", () => ({
  product: { id: "id", sellerId: "seller_id", status: "status" },
}))
vi.mock("@/features/reviews/db/reputation-thresholds", () => ({
  getEnabledThresholdIds: vi.fn().mockResolvedValue(
    new Set(["rating_below_archive", "negative_streak", "tag_concentration", "positive_burst"])
  ),
}))
vi.mock("@/lib/query-timeout", () => ({
  withQueryTimeout: vi.fn((p: Promise<unknown>) => p),
}))
vi.mock("@/drizzle/db", () => ({
  db: { select: vi.fn(), execute: vi.fn() },
}))

import { db } from "@/drizzle/db"
import { getOpenReputationCases, getReputationCaseCounts } from "@/features/reviews/db/reputation-cases"

function mockGroupByHaving(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      groupBy: vi.fn().mockReturnValue({
        having: vi.fn().mockResolvedValue(rows),
      }),
    }),
  }
}

// A permissive chain double for "nothing matches" scenarios: every builder
// method (where/groupBy/having/orderBy) returns the same chainable node, and
// the node itself is thenable, resolving to `rows` regardless of which
// methods were called or in what order. Used where a single db.select mock
// must satisfy several structurally different queries in one test.
function mockEmptyChain(rows: unknown[] = []) {
  const node: Record<string, unknown> = {
    then: (resolve: (v: unknown) => void) => resolve(rows),
  }
  for (const method of ["where", "groupBy", "having", "orderBy"]) {
    node[method] = vi.fn(() => node)
  }
  return { from: vi.fn(() => node) }
}

describe("getOpenReputationCases", () => {
  beforeEach(() => vi.clearAllMocks())

  it("flags a seller below the rating floor and excludes archived sellers", async () => {
    // Rule 1 (rating_below_archive): one seller matches
    vi.mocked(db.select).mockReturnValueOnce(
      mockGroupByHaving([
        { sellerUserId: "seller-1", avgScore: 3.5, reviewCount: 40, maxReviewCreatedAt: new Date("2026-08-01") },
      ]) as never
    )
    // Rule 2/3/5 use db.execute (raw SQL) — return empty for this test
    vi.mocked(db.execute).mockResolvedValue([] as never)
    // Dismissal lookup (db.select) — none
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    } as never)
    // Archived sellers lookup — seller-2 archived
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ sellerUserId: "seller-2" }]) }),
    } as never)
    // Page hydration: user lookup
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([
        { id: "seller-1", name: "Pyin Oo Lwin Stones", image: null, premiumDealerExpiresAt: null },
      ]) }),
    } as never)
    // Page hydration: per-seller rating aggregates (avgAll/avgBefore30d/negativeCount)
    vi.mocked(db.execute).mockResolvedValueOnce([
      { seller_user_id: "seller-1", avg_all: 3.5, avg_before_30d: 3.9, negative_count: 12, review_count: 40 },
    ] as never)
    // Page hydration: recent reviews
    vi.mocked(db.execute).mockResolvedValueOnce([] as never)
    // Page hydration: active listings count
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ sellerUserId: "seller-1", count: 12 }]) }),
    } as never)
    // Page hydration: prior warnings count
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    } as never)

    const result = await getOpenReputationCases({ tab: "all", page: 1, limit: 20 })

    expect(result.total).toBe(1)
    expect(result.cases).toHaveLength(1)
    expect(result.cases[0].sellerUserId).toBe("seller-1")
    expect(result.cases[0].severity).toBe("critical")
  })
})

describe("getReputationCaseCounts", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns zero counts when nothing matches any rule", async () => {
    vi.mocked(db.select).mockReturnValue(mockEmptyChain() as never)
    vi.mocked(db.execute).mockResolvedValue([] as never)

    const counts = await getReputationCaseCounts()

    expect(counts.all).toBe(0)
    expect(counts.critical).toBe(0)
    expect(counts.buyerReports).toBe(0)
    expect(counts.closed).toBe(0)
  })
})
