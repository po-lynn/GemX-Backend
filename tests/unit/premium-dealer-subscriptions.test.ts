import { beforeEach, describe, expect, it, vi } from "vitest"
import { getPremiumDealerSubscriptionsPaginated } from "@/features/points/db/points"
import { db } from "@/drizzle/db"

vi.mock("drizzle-orm", () => ({
  and: vi.fn(() => "and"),
  eq: vi.fn(() => "eq"),
  gte: vi.fn(() => "gte"),
  gt: vi.fn(() => "gt"),
  desc: vi.fn(() => "desc"),
  inArray: vi.fn(() => "inArray"),
  isNotNull: vi.fn(() => "isNotNull"),
  isNull: vi.fn(() => "isNull"),
  or: vi.fn(() => "or"),
  sql: vi.fn((x: unknown) => x),
}))

vi.mock("@/drizzle/schema/auth-schema", () => ({
  user: {
    id: "id",
    points: "points",
    name: "name",
    email: "email",
    username: "username",
    image: "image",
    city: "city",
    premiumDealerPackageName: "premium_dealer_package_name",
    premiumDealerExpiresAt: "premium_dealer_expires_at",
  },
}))

vi.mock("@/drizzle/schema/points-schema", () => ({
  pointSetting: { key: "key", value: "value", valueText: "value_text" },
  pointPurchaseRequest: {
    id: "id",
    userId: "user_id",
    points: "points",
    status: "status",
    packageName: "package_name",
    price: "price",
    currency: "currency",
    transferredAmount: "transferred_amount",
    transferredName: "transferred_name",
    transactionReference: "transaction_reference",
    transferNote: "transfer_note",
    adminNote: "admin_note",
    reviewedByAdminId: "reviewed_by_admin_id",
    reviewedAt: "reviewed_at",
    createdAt: "created_at",
  },
  premiumDealersPackage: {
    id: "id",
    userId: "user_id",
    packageName: "package_name",
    startDate: "start_date",
    endDate: "end_date",
    autoRenew: "auto_renew",
    status: "status",
    createdAt: "created_at",
  },
  premiumDealerPackageStatusEnum: vi.fn(),
}))

vi.mock("@/drizzle/db", () => ({
  db: {
    select: vi.fn(),
  },
}))

vi.mock("@/drizzle/schema/seller-rating-schema", () => ({
  sellerRating: { sellerUserId: "seller_user_id", score: "score" },
}))

function makeChain(result: unknown) {
  const chain: Record<string, unknown> = {}
  for (const m of ["from", "leftJoin", "where", "orderBy", "limit", "offset"]) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
  chain.catch = (reject: (e: unknown) => unknown) => (Promise.resolve(result) as Promise<unknown>).catch(reject)
  return chain
}

const START = new Date("2026-04-01T00:00:00.000Z")
const END = new Date("2026-05-01T00:00:00.000Z")
const CREATED = new Date("2026-04-01T00:00:00.000Z")

const FAKE_ROW = {
  id: "sub-1",
  userId: "user-1",
  userName: "Alice",
  userEmail: "alice@example.com",
  packageName: "Standard Package",
  startDate: START,
  endDate: END,
  autoRenew: false,
  status: "active",
  createdAt: CREATED,
}

describe("getPremiumDealerSubscriptionsPaginated", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns subscriptions and total on the first page", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeChain([FAKE_ROW]) as never)
      .mockReturnValueOnce(makeChain([{ count: 1 }]) as never)

    const result = await getPremiumDealerSubscriptionsPaginated({ page: 1, limit: 20 })

    expect(result.total).toBe(1)
    expect(result.subscriptions).toHaveLength(1)
    expect(result.subscriptions[0]).toMatchObject({
      id: "sub-1",
      userId: "user-1",
      userName: "Alice",
      userEmail: "alice@example.com",
      packageName: "Standard Package",
      status: "active",
      autoRenew: false,
    })
  })

  it("returns empty subscriptions when none exist", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeChain([]) as never)
      .mockReturnValueOnce(makeChain([{ count: 0 }]) as never)

    const result = await getPremiumDealerSubscriptionsPaginated({ page: 1, limit: 20 })

    expect(result.total).toBe(0)
    expect(result.subscriptions).toHaveLength(0)
  })

  it("passes status filter to the query when provided", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeChain([FAKE_ROW]) as never)
      .mockReturnValueOnce(makeChain([{ count: 1 }]) as never)

    await getPremiumDealerSubscriptionsPaginated({ page: 1, limit: 20, status: "active" })

    // eq() should have been called with the status field and value
    const { eq } = await import("drizzle-orm")
    expect(eq).toHaveBeenCalledWith("status", "active")
  })

  it("does not apply a where clause when status is omitted", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeChain([]) as never)
      .mockReturnValueOnce(makeChain([{ count: 0 }]) as never)

    await getPremiumDealerSubscriptionsPaginated({ page: 1, limit: 20 })

    const { eq } = await import("drizzle-orm")
    // eq() should not be called with a status string
    const statusCalls = vi.mocked(eq).mock.calls.filter(
      ([, v]) => v === "active" || v === "expired" || v === "cancelled"
    )
    expect(statusCalls).toHaveLength(0)
  })

  it("returns 0 total gracefully when count row is missing", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeChain([]) as never)
      .mockReturnValueOnce(makeChain([]) as never)

    const result = await getPremiumDealerSubscriptionsPaginated({ page: 1, limit: 20 })

    expect(result.total).toBe(0)
  })
})
