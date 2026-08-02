import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import {
  getArticlesPaginatedFromDb,
  getArticleStatusCountsFromDb,
} from "@/features/articles/db/articles"
import { QueryTimeoutError } from "@/lib/query-timeout"
import AdminArticlesPage from "@/app/admin/articles/page"

// Regression test mirroring tests/unit/admin-products-page-query-timing.test.ts: this page
// used Promise.all across the status counts and paginated list with no timeout, so one
// stalled query hung the whole Server Component render indefinitely. Verifies the calls now
// run sequentially and are timeout-guarded, matching app/admin/products/page.tsx's pattern.

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/lib/admin-guard", () => ({ requireFeatureAccess: vi.fn() }))
vi.mock("@/features/articles/db/articles", () => ({
  getArticlesPaginatedFromDb: vi.fn(),
  getArticleStatusCountsFromDb: vi.fn(),
}))
vi.mock("@/features/articles/components", () => ({
  ArticlesTable: () => null,
}))
vi.mock("@/components/admin/motion", () => ({
  FadeUp: ({ children }: { children: React.ReactNode }) => children,
}))

const emptyList = { items: [], total: 0 }
const emptyCounts = { all: 0, published: 0, draft: 0 }

function searchParams(params: Record<string, string> = {}) {
  return Promise.resolve(params)
}

describe("AdminArticlesPage query concurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(requireFeatureAccess).mockResolvedValue(undefined as never)
    vi.mocked(getArticlesPaginatedFromDb).mockResolvedValue(emptyList)
    vi.mocked(getArticleStatusCountsFromDb).mockResolvedValue(emptyCounts)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Validates: the status-counts query runs before the paginated list query — not
  // concurrently — so the page never holds more than one pooler connection open at once.
  it("queries status counts, then the paginated list — never concurrently", async () => {
    const order: string[] = []
    vi.mocked(getArticleStatusCountsFromDb).mockImplementation(async () => {
      order.push("counts")
      return emptyCounts
    })
    vi.mocked(getArticlesPaginatedFromDb).mockImplementation(async () => {
      order.push("list")
      return emptyList
    })

    await AdminArticlesPage({ searchParams: searchParams() })
    expect(order).toEqual(["counts", "list"])
  })

  // Validates: a hung paginated-list query (the primary content this page exists to show)
  // causes the render to reject once the timeout elapses, instead of hanging forever —
  // Next.js turns this rejection into the nearest error.tsx boundary.
  it("rejects with QueryTimeoutError when the primary list query hangs past the timeout", async () => {
    vi.useFakeTimers()
    vi.mocked(getArticlesPaginatedFromDb).mockReturnValue(new Promise(() => {}))

    const pagePromise = AdminArticlesPage({ searchParams: searchParams() })
    const assertion = expect(pagePromise).rejects.toBeInstanceOf(QueryTimeoutError)
    await vi.advanceTimersByTimeAsync(6000)
    await assertion
  })
})
