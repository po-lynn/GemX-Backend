import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import {
  getCollectorPieceShowRequestsPaginated,
  getCollectorPieceShowRequestsKPIs,
} from "@/features/collector-piece-show-requests/db/collector-piece-show-requests"
import { QueryTimeoutError } from "@/lib/query-timeout"
import AdminCollectorPieceShowRequestsPage from "@/app/admin/collector-piece-show-requests/page"

// Regression test mirroring tests/unit/admin-products-page-query-timing.test.ts: this page's
// Promise.all (paginated requests + KPIs) was previously flagged as a connection-pool risk
// (docs/technical/connection-pool-hardening.md) but never fixed. The paginated request list
// is primary (timeout-guarded, throws to error.tsx on hang); the KPI tiles are secondary
// (degrade to a zeroed fallback via lib/db-timeout's withTimeout instead of failing the page).

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/lib/admin-guard", () => ({ requireFeatureAccess: vi.fn() }))
vi.mock("@/features/collector-piece-show-requests/db/collector-piece-show-requests", () => ({
  getCollectorPieceShowRequestsPaginated: vi.fn(),
  getCollectorPieceShowRequestsKPIs: vi.fn(),
}))
vi.mock("@/features/collector-piece-show-requests/components/CollectorPieceShowRequestsTable", () => ({
  CollectorPieceShowRequestsTable: () => null,
}))
vi.mock("@/components/admin/motion", () => ({
  FadeUp: ({ children }: { children: React.ReactNode }) => children,
}))

const emptyKpis = { totalPending: 0, approvedCount: 0, highValuePending: 0, totalCount: 0 }

function searchParams(params: Record<string, string> = {}) {
  return Promise.resolve(params)
}

describe("AdminCollectorPieceShowRequestsPage query concurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(requireFeatureAccess).mockResolvedValue(undefined as never)
    vi.mocked(getCollectorPieceShowRequestsPaginated).mockResolvedValue({ requests: [], total: 0 })
    vi.mocked(getCollectorPieceShowRequestsKPIs).mockResolvedValue(emptyKpis)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Validates: the paginated list resolves before the KPI query starts, so the page never
  // holds more than one pooler connection open for its own calls at any given moment.
  it("queries the paginated request list, then KPIs — never concurrently", async () => {
    const order: string[] = []
    vi.mocked(getCollectorPieceShowRequestsPaginated).mockImplementation(async () => {
      order.push("list")
      return { requests: [], total: 0 }
    })
    vi.mocked(getCollectorPieceShowRequestsKPIs).mockImplementation(async () => {
      order.push("kpis")
      return emptyKpis
    })

    await AdminCollectorPieceShowRequestsPage({ searchParams: searchParams() })
    expect(order).toEqual(["list", "kpis"])
  })

  // Validates: a hung primary query (the paginated request list) causes the render to
  // reject once the timeout elapses, instead of hanging forever — Next.js turns this
  // rejection into the nearest error.tsx boundary.
  it("rejects with QueryTimeoutError when the primary list query hangs past the timeout", async () => {
    vi.useFakeTimers()
    vi.mocked(getCollectorPieceShowRequestsPaginated).mockReturnValue(new Promise(() => {}))

    const pagePromise = AdminCollectorPieceShowRequestsPage({ searchParams: searchParams() })
    const assertion = expect(pagePromise).rejects.toBeInstanceOf(QueryTimeoutError)
    await vi.advanceTimersByTimeAsync(6000)
    await assertion
  })

  // Validates: a hung/failing secondary KPI query degrades to the zeroed fallback instead
  // of failing the whole page — the primary request list still renders.
  it("degrades to the KPI fallback instead of throwing when the KPI query hangs past the timeout", async () => {
    vi.useFakeTimers()
    vi.mocked(getCollectorPieceShowRequestsKPIs).mockReturnValue(new Promise(() => {}))

    const pagePromise = AdminCollectorPieceShowRequestsPage({ searchParams: searchParams() })
    await vi.advanceTimersByTimeAsync(6000)
    await expect(pagePromise).resolves.toBeDefined()
  })
})
