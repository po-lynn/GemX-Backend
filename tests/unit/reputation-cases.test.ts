import { beforeEach, describe, expect, it, vi } from "vitest"

// Records every sql`` template built by the module under test, including the
// ones handed to query-builder .where() rather than db.execute(), so the
// seller-id binding test below can assert on query shape at all four
// hydrateCases sites. Hoisted so the vi.mock factory can close over it.
const captured = vi.hoisted(() => ({ queries: [] as string[], joinChunks: [] as unknown[][] }))

vi.mock("drizzle-orm", () => ({
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => {
      captured.queries.push([...strings].join(""))
      return { strings, values }
    },
    {
      raw: (s: string) => s,
      join: (chunks: unknown[], separator?: unknown) => {
        captured.joinChunks.push(chunks)
        return { chunks, separator }
      },
    }
  ),
  eq: vi.fn(() => "eq"),
  inArray: vi.fn(() => "inArray"),
  and: vi.fn(() => "and"),
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

describe("hydrateCases seller-id binding", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    captured.queries.length = 0
    captured.joinChunks.length = 0
  })

  /**
   * Regression guard for the `= ANY(${sellerIds})` crash.
   *
   * Embedding a plain JS string[] in a raw sql`` template binds it as ONE
   * stringified parameter, not as a Postgres array — so every hydrateCases query
   * using `= ANY(${sellerIds})` died at runtime with:
   *
   *   PostgresError: malformed array literal: "VAHvEEbt..." (code 22P02)
   *   detail: Array value must start with "{" or dimension information.
   *
   * That made /admin/reviews/cases throw a server-side exception the moment ANY
   * seller had review data. It survived twelve task reviews plus a whole-branch
   * review because every test in this suite mocks db.execute — a mock never
   * parses an array literal, so the bug is invisible to assertions about returned
   * data. The query SHAPE is therefore the only contract a unit test can hold:
   * one bind per id via sql.join, spliced into an IN (...) list.
   *
   * The real fix was verified separately against a live Postgres database.
   */
  it("binds seller ids as an IN list with one parameter per id, never = ANY()", async () => {
    // Two sellers matching rule 1 so the per-id bind count is meaningful (a
    // single id could not distinguish one array bind from one scalar bind).
    vi.mocked(db.select).mockReturnValue(mockEmptyChain() as never)
    vi.mocked(db.select).mockReturnValueOnce(
      mockGroupByHaving([
        { sellerUserId: "seller-1", avgScore: 3.5, reviewCount: 40, maxReviewCreatedAt: new Date("2026-08-01") },
        { sellerUserId: "seller-2", avgScore: 3.1, reviewCount: 55, maxReviewCreatedAt: new Date("2026-08-02") },
      ]) as never
    )
    vi.mocked(db.execute).mockResolvedValue([] as never)

    await getOpenReputationCases({ tab: "all", page: 1, limit: 20 })

    // No query anywhere may reintroduce the array-in-template pattern.
    expect(captured.queries.filter((q) => q.includes("ANY("))).toEqual([])

    // All four hydrateCases sites must splice the parameterized IN list.
    const find = (needle: string) => captured.queries.find((q) => q.includes(needle))
    const aggQuery = find("AS avg_before_30d") // raw db.execute: rating aggregates
    const reviewsQuery = find("AS buyer_name") // raw db.execute: recent reviews
    const listingsQuery = find("= 'active'") // builder .where(): active listings
    const warningsQuery = find("'warned', 'archived', 'limited_orders'") // builder .where(): prior warnings

    for (const query of [aggQuery, reviewsQuery, listingsQuery, warningsQuery]) {
      expect(query).toBeDefined()
      expect(query).toContain("IN (")
    }

    // sql.join must receive one chunk per seller id — that is what turns into
    // one bind parameter per id instead of a single stringified array.
    expect(captured.joinChunks).toHaveLength(1)
    expect(captured.joinChunks[0]).toHaveLength(2)
  })
})

describe("matchTagConcentration (tag_concentration rule SQL)", () => {
  beforeEach(() => vi.clearAllMocks())

  /**
   * Regression guard for the count(*) vs count(DISTINCT sr.id) bug.
   *
   * rating_tag_map is many-to-many, so the LEFT JOIN chain
   * seller_rating -> rating_tag_map -> rating_tags emits one row per (review,
   * tag) pair. Consider a seller with exactly 5 reviews in the last 30 days,
   * each carrying 2 tags:
   *
   *   count(*)               = 10  -> passes the ">= 10 reviews" sample gate (WRONG:
   *                                   it's a 5-review seller, far too small a sample)
   *   count(DISTINCT sr.id)  =  5  -> correctly fails the gate
   *
   * The same divergence corrupts the ratio: a review with 3 unrelated tags adds
   * 3 to a count(*) denominator, diluting a genuine Bad Communication
   * concentration below the 25% line and suppressing a real case.
   *
   * The rule is raw SQL executed by Postgres, so the counting semantics can't be
   * exercised through the db mock — the query text itself is the contract. This
   * asserts every one of the five review-counting sites uses count(DISTINCT
   * sr.id) and that no bare count(*) survives anywhere in the query.
   */
  it("counts distinct reviews, not tag-map rows, at every counting site", async () => {
    vi.mocked(db.select).mockReturnValue(mockEmptyChain() as never)
    vi.mocked(db.execute).mockResolvedValue([] as never)

    await getReputationCaseCounts()

    const tagQuery = vi
      .mocked(db.execute)
      // The drizzle-orm mock above replaces `sql` with a plain tagged-template
      // capture, so what db.execute actually receives here is { strings, values }.
      .mock.calls.map((call) => (call[0] as unknown as { strings: string[] }).strings.join(""))
      .find((q) => q.includes("Bad Communication"))

    expect(tagQuery).toBeDefined()
    // A single count(*) anywhere reintroduces the tag-instance bug.
    expect(tagQuery).not.toMatch(/count\(\*\)/)
    // The sample gate: >= 10 REVIEWS, not >= 10 tag rows.
    expect(tagQuery).toContain("count(DISTINCT sr.id) >= 10")
    // Ratio numerator (reviews carrying the tag) and denominator (all reviews).
    expect(tagQuery).toContain(
      "count(DISTINCT sr.id) FILTER (WHERE rt.name = 'Bad Communication')::numeric"
    )
    expect(tagQuery).toContain("/ count(DISTINCT sr.id) > 0.25")
    // Projected columns feeding the "N% of reviews tagged…" detail string.
    expect(tagQuery).toContain("count(DISTINCT sr.id)::int AS total_count")
    expect(tagQuery).toContain(
      "count(DISTINCT sr.id) FILTER (WHERE rt.name = 'Bad Communication')::int AS tagged_count"
    )
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
