import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import {
  getPremiumDealerSubscriptionsPaginated,
  getPremiumDealerSubscriptionCounts,
  getPremiumDealersSettings,
} from "@/features/points/db/points"
import { QueryTimeoutError } from "@/lib/query-timeout"
import AdminPremiumDealerSubscriptionsPage from "@/app/admin/credit/premium-dealer-subscriptions/page"

// Regression test mirroring tests/unit/admin-products-page-query-timing.test.ts: this page
// used to fire all three DB calls concurrently via Promise.all. The paginated subscriptions
// list and tab counts are primary — they run sequentially and throw on timeout. The dealer
// package settings only feed the "activate premium dealer" dialog, so they're secondary and
// degrade to an empty package list instead of failing the whole page.

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/lib/admin-guard", () => ({ requireFeatureAccess: vi.fn() }))
vi.mock("@/features/points/db/points", () => ({
  getPremiumDealerSubscriptionsPaginated: vi.fn(),
  getPremiumDealerSubscriptionCounts: vi.fn(),
  getPremiumDealersSettings: vi.fn(),
}))
vi.mock("@/features/points/components/PremiumDealerSubscriptionsTable", () => ({
  PremiumDealerSubscriptionsTable: () => null,
}))
vi.mock("@/features/points/components/ActivatePremiumDealerDialog", () => ({
  ActivatePremiumDealerDialog: () => null,
}))
vi.mock("@/components/admin/motion", () => ({
  FadeUp: ({ children }: { children: React.ReactNode }) => children,
  PressButton: ({ children }: { children: React.ReactNode }) => children,
}))

const emptyCounts = { all: 0, active: 0, expired: 0, cancelled: 0 }
const emptyCurrent = { subscriptions: [], total: 0 }
const emptyDealerSettings = { packages: [] }

function searchParams(params: Record<string, string> = {}) {
  return Promise.resolve(params)
}

describe("AdminPremiumDealerSubscriptionsPage query concurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(requireFeatureAccess).mockResolvedValue(undefined as never)
    vi.mocked(getPremiumDealerSubscriptionsPaginated).mockResolvedValue(emptyCurrent)
    vi.mocked(getPremiumDealerSubscriptionCounts).mockResolvedValue(emptyCounts)
    vi.mocked(getPremiumDealersSettings).mockResolvedValue(emptyDealerSettings)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Validates: the primary list and counts queries run one at a time (not Promise.all).
  it("queries the subscriptions list, then counts — never concurrently", async () => {
    const order: string[] = []
    vi.mocked(getPremiumDealerSubscriptionsPaginated).mockImplementation(async () => {
      order.push("list")
      return emptyCurrent
    })
    vi.mocked(getPremiumDealerSubscriptionCounts).mockImplementation(async () => {
      order.push("counts")
      return emptyCounts
    })

    await AdminPremiumDealerSubscriptionsPage({ searchParams: searchParams() })
    expect(order).toEqual(["list", "counts"])
  })

  // Validates: a hung primary list query causes the render to reject once the timeout
  // elapses, instead of hanging forever — Next.js turns this into the nearest error.tsx.
  it("rejects with QueryTimeoutError when the subscriptions list query hangs past the timeout", async () => {
    vi.useFakeTimers()
    vi.mocked(getPremiumDealerSubscriptionsPaginated).mockReturnValue(new Promise(() => {}))

    const pagePromise = AdminPremiumDealerSubscriptionsPage({ searchParams: searchParams() })
    const assertion = expect(pagePromise).rejects.toBeInstanceOf(QueryTimeoutError)
    await vi.advanceTimersByTimeAsync(6000)
    await assertion
  })

  // Validates: a hung secondary dealer-settings query degrades to the fallback instead of
  // failing the whole page.
  it("falls back to an empty package list when the dealer settings query hangs", async () => {
    vi.useFakeTimers()
    vi.mocked(getPremiumDealersSettings).mockReturnValue(new Promise(() => {}))

    const pagePromise = AdminPremiumDealerSubscriptionsPage({ searchParams: searchParams() })
    await vi.advanceTimersByTimeAsync(6000)
    await expect(pagePromise).resolves.toBeDefined()
  })
})
