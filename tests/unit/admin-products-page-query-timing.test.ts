import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import {
  getAdminProductsFromDb,
  getAdminProductCountsFromDb,
  getAdminProductFacetCounts,
} from "@/features/products/db/products"
import { QueryTimeoutError } from "@/lib/query-timeout"
import AdminProductsPage from "@/app/admin/products/page"

// Regression test for the stuck-loading-skeleton bug (Aug 2, 2026 recording): the page
// used Promise.all across three heavy DB calls with no timeout, so one stalled query
// hung the whole Server Component render indefinitely. Verifies the calls now run
// sequentially and are timeout-guarded, matching app/api/products/route.ts and
// app/api/news/route.ts.

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/lib/admin-guard", () => ({ requireFeatureAccess: vi.fn() }))
vi.mock("@/features/products/db/products", () => ({
  getAdminProductsFromDb: vi.fn(),
  getAdminProductCountsFromDb: vi.fn(),
  getAdminProductFacetCounts: vi.fn(),
}))
vi.mock("@/features/products/components/ProductsListView", () => ({
  ProductsListView: () => null,
}))
vi.mock("@/components/admin/motion", () => ({
  FadeUp: ({ children }: { children: React.ReactNode }) => children,
  PressButton: ({ children }: { children: React.ReactNode }) => children,
}))

const emptyCounts = { all: 0, pending: 0, featured: 0, collector: 0, sold: 0, drafts: 0 }
const emptyFacets = {
  stoneCut: {}, metal: {}, shape: {}, identification: {}, productType: {},
  moderationStatus: {}, category: [], flags: { featured: 0, collector: 0, privilege: 0 },
} as never

function searchParams(params: Record<string, string> = {}) {
  return Promise.resolve(params)
}

describe("AdminProductsPage query concurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(requireFeatureAccess).mockResolvedValue(undefined as never)
    vi.mocked(getAdminProductCountsFromDb).mockResolvedValue(emptyCounts)
    vi.mocked(getAdminProductsFromDb).mockResolvedValue({ products: [], total: 0 })
    vi.mocked(getAdminProductFacetCounts).mockResolvedValue(emptyFacets)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Validates: the three queries run one at a time (not Promise.all), so the page never
  // holds more than one pooler connection open for its own calls at any given moment.
  it("queries counts, then the list, then facet counts — never concurrently", async () => {
    const order: string[] = []
    vi.mocked(getAdminProductCountsFromDb).mockImplementation(async () => {
      order.push("counts")
      return emptyCounts
    })
    vi.mocked(getAdminProductsFromDb).mockImplementation(async () => {
      order.push("list")
      return { products: [], total: 0 }
    })
    vi.mocked(getAdminProductFacetCounts).mockImplementation(async () => {
      order.push("facets")
      return emptyFacets
    })

    await AdminProductsPage({ searchParams: searchParams() })
    expect(order).toEqual(["counts", "list", "facets"])
  })

  // Validates: a hung facet-counts query (the one with the most internal round-trips)
  // causes the render to reject once the timeout elapses, instead of hanging forever —
  // Next.js turns this rejection into the nearest error.tsx boundary.
  it("rejects with QueryTimeoutError when a query hangs past the timeout", async () => {
    vi.useFakeTimers()
    vi.mocked(getAdminProductFacetCounts).mockReturnValue(new Promise(() => {}))

    const pagePromise = AdminProductsPage({ searchParams: searchParams() })
    const assertion = expect(pagePromise).rejects.toBeInstanceOf(QueryTimeoutError)
    await vi.advanceTimersByTimeAsync(6000)
    await assertion
  })
})
