import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import {
  getPointPurchaseRequestsPaginated,
  getPointPurchaseRequestCounts,
  getPointPurchasePackagesSettings,
  getPointManagementSettings,
} from "@/features/points/db/points"
import { QueryTimeoutError } from "@/lib/query-timeout"
import AdminPointPurchaseRequestsPage from "@/app/admin/credit/purchase-requests/page"

// Regression test mirroring tests/unit/admin-products-page-query-timing.test.ts: this page
// used to fire all four DB calls concurrently via Promise.all, so a single stalled query
// could hang the whole Server Component render indefinitely under Supabase pooler
// saturation. The paginated requests list (staff approve/reject KBZ Pay wire-transfer point
// purchases here) and tab counts are primary — they run sequentially and throw on timeout.
// The packages/payment-method settings only feed dropdown options in the "create request"
// dialog, so they're secondary and degrade to empty option lists instead.

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/lib/admin-guard", () => ({ requireFeatureAccess: vi.fn() }))
vi.mock("@/features/points/db/points", () => ({
  getPointPurchaseRequestsPaginated: vi.fn(),
  getPointPurchaseRequestCounts: vi.fn(),
  getPointPurchasePackagesSettings: vi.fn(),
  getPointManagementSettings: vi.fn(),
}))
vi.mock("@/features/points/components/PointPurchaseRequestsTable", () => ({
  PointPurchaseRequestsTable: () => null,
}))
vi.mock("@/features/points/components/AdminCreatePurchaseRequestDialog", () => ({
  AdminCreatePurchaseRequestDialog: () => null,
}))
vi.mock("@/components/admin/motion", () => ({
  FadeUp: ({ children }: { children: React.ReactNode }) => children,
  PressButton: ({ children }: { children: React.ReactNode }) => children,
}))

const emptyCounts = { all: 0, pending: 0, approved: 0, rejected: 0 }
const emptyCurrent = { requests: [], total: 0 }
const emptyPackagesSettings = { packages: [] }
const emptyManagementSettings = {
  defaultRegistrationPoints: 0,
  registrationBonusEnabled: false,
  registrationBonusDescription: "",
  currencyConversion: {
    mmk: { amount: 1, points: 0 },
    usd: { amount: 1, points: 0 },
    krw: { amount: 1, points: 0 },
  },
  minimumSpendAmount: 0,
  minimumSpendCurrency: "mmk" as const,
  roundingMethod: "nearest" as const,
  pointExpiryDays: 0,
  paymentMethods: [],
}

function searchParams(params: Record<string, string> = {}) {
  return Promise.resolve(params)
}

describe("AdminPointPurchaseRequestsPage query concurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(requireFeatureAccess).mockResolvedValue(undefined as never)
    vi.mocked(getPointPurchaseRequestsPaginated).mockResolvedValue(emptyCurrent)
    vi.mocked(getPointPurchaseRequestCounts).mockResolvedValue(emptyCounts)
    vi.mocked(getPointPurchasePackagesSettings).mockResolvedValue(emptyPackagesSettings)
    vi.mocked(getPointManagementSettings).mockResolvedValue(emptyManagementSettings)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Validates: the primary list and counts queries run one at a time (not Promise.all), so
  // the page never holds more than one pooler connection open for its primary calls at once.
  it("queries the requests list, then counts — never concurrently", async () => {
    const order: string[] = []
    vi.mocked(getPointPurchaseRequestsPaginated).mockImplementation(async () => {
      order.push("list")
      return emptyCurrent
    })
    vi.mocked(getPointPurchaseRequestCounts).mockImplementation(async () => {
      order.push("counts")
      return emptyCounts
    })

    await AdminPointPurchaseRequestsPage({ searchParams: searchParams() })
    expect(order).toEqual(["list", "counts"])
  })

  // Validates: a hung primary list query causes the render to reject once the timeout
  // elapses, instead of hanging forever — Next.js turns this into the nearest error.tsx.
  it("rejects with QueryTimeoutError when the requests list query hangs past the timeout", async () => {
    vi.useFakeTimers()
    vi.mocked(getPointPurchaseRequestsPaginated).mockReturnValue(new Promise(() => {}))

    const pagePromise = AdminPointPurchaseRequestsPage({ searchParams: searchParams() })
    const assertion = expect(pagePromise).rejects.toBeInstanceOf(QueryTimeoutError)
    await vi.advanceTimersByTimeAsync(6000)
    await assertion
  })

  // Validates: a hung secondary settings query degrades to the fallback instead of failing
  // the whole page — the primary list/counts still resolve.
  it("falls back to empty settings when the secondary settings queries hang", async () => {
    vi.useFakeTimers()
    vi.mocked(getPointPurchasePackagesSettings).mockReturnValue(new Promise(() => {}))
    vi.mocked(getPointManagementSettings).mockReturnValue(new Promise(() => {}))

    const pagePromise = AdminPointPurchaseRequestsPage({ searchParams: searchParams() })
    await vi.advanceTimersByTimeAsync(6000)
    await expect(pagePromise).resolves.toBeDefined()
  })
})
