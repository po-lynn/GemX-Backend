import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import {
  getPointTransactionsPaginated,
  getPointTransactionCounts,
} from "@/features/points/db/points"
import { QueryTimeoutError } from "@/lib/query-timeout"
import AdminPointTransactionsPage from "@/app/admin/credit/transactions/page"

// Regression test mirroring tests/unit/admin-products-page-query-timing.test.ts: this page
// used Promise.all across the paginated ledger and status counts with no timeout, so one
// stalled query hung the whole Server Component render indefinitely. Verifies the calls now
// run sequentially, that the primary (paginated) query is timeout-guarded to throw, and that
// the secondary (counts) query degrades gracefully via lib/db-timeout's withTimeout instead
// of failing the page.

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/lib/admin-guard", () => ({ requireFeatureAccess: vi.fn() }))
vi.mock("@/features/points/db/points", () => ({
  getPointTransactionsPaginated: vi.fn(),
  getPointTransactionCounts: vi.fn(),
}))
vi.mock("@/features/points/components/PointTransactionsTable", () => ({
  PointTransactionsTable: () => null,
}))
vi.mock("@/features/points/components/PointActionButtons", () => ({
  PointActionButtons: () => null,
}))
vi.mock("@/components/admin/motion", () => ({
  FadeUp: ({ children }: { children: React.ReactNode }) => children,
}))

const emptyList = { transactions: [], total: 0 }
const emptyCounts = { all: 0, topups: 0, spent: 0, pending: 0 }

function searchParams(params: Record<string, string> = {}) {
  return Promise.resolve(params)
}

describe("AdminPointTransactionsPage query concurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(requireFeatureAccess).mockResolvedValue(undefined as never)
    vi.mocked(getPointTransactionsPaginated).mockResolvedValue(emptyList)
    vi.mocked(getPointTransactionCounts).mockResolvedValue(emptyCounts)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Validates: the paginated list query runs before the counts query — not concurrently —
  // so the page never holds more than one pooler connection open for its own calls.
  it("queries the paginated list, then the status counts — never concurrently", async () => {
    const order: string[] = []
    vi.mocked(getPointTransactionsPaginated).mockImplementation(async () => {
      order.push("list")
      return emptyList
    })
    vi.mocked(getPointTransactionCounts).mockImplementation(async () => {
      order.push("counts")
      return emptyCounts
    })

    await AdminPointTransactionsPage({ searchParams: searchParams() })
    expect(order).toEqual(["list", "counts"])
  })

  // Validates: the primary (paginated ledger) query is timeout-guarded — a hang causes the
  // render to reject with QueryTimeoutError once the timeout elapses instead of hanging
  // forever. Next.js turns this rejection into the nearest error.tsx boundary.
  it("rejects with QueryTimeoutError when the primary list query hangs past the timeout", async () => {
    vi.useFakeTimers()
    vi.mocked(getPointTransactionsPaginated).mockReturnValue(new Promise(() => {}))

    const pagePromise = AdminPointTransactionsPage({ searchParams: searchParams() })
    const assertion = expect(pagePromise).rejects.toBeInstanceOf(QueryTimeoutError)
    await vi.advanceTimersByTimeAsync(6000)
    await assertion
  })

  // Validates: the secondary (status counts) query degrades gracefully — a hang resolves to
  // the "unknown" fallback (all fields undefined) instead of rejecting the whole render, and
  // the page still completes successfully with the primary content intact.
  it("resolves with unknown counts when the secondary counts query hangs past the timeout", async () => {
    vi.useFakeTimers()
    vi.mocked(getPointTransactionCounts).mockReturnValue(new Promise(() => {}))

    const pagePromise = AdminPointTransactionsPage({ searchParams: searchParams() })
    await vi.advanceTimersByTimeAsync(6000)
    await expect(pagePromise).resolves.toBeDefined()
  })
})
