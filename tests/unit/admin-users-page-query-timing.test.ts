import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import {
  getUsersPaginatedFromDb,
  getUserStatsFromDb,
  getViewCountsFromDb,
} from "@/features/users/db/users"
import { getPushTokensByUserIds } from "@/features/push/db/push-tokens"
import { QueryTimeoutError } from "@/lib/query-timeout"
import AdminUsersPage from "@/app/admin/users/page"

// Regression test mirroring tests/unit/admin-products-page-query-timing.test.ts: this page
// used Promise.all across three heavy DB calls (paginated users, stats, view-tab counts)
// with no timeout, matching the same stuck-loading-skeleton root cause as
// app/admin/products/page.tsx. Verifies the calls now run sequentially and are
// timeout-guarded.

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/lib/admin-guard", () => ({ requireFeatureAccess: vi.fn() }))
vi.mock("@/features/users/db/users", () => ({
  getUsersPaginatedFromDb: vi.fn(),
  getUserStatsFromDb: vi.fn(),
  getViewCountsFromDb: vi.fn(),
}))
vi.mock("@/features/push/db/push-tokens", () => ({
  getPushTokensByUserIds: vi.fn(),
}))
vi.mock("@/features/users/components", () => ({
  UsersTable: () => null,
}))
vi.mock("@/components/admin/motion", () => ({
  FadeUp: ({ children }: { children: React.ReactNode }) => children,
}))

const emptyStats = { total: 0, active: 0, verified: 0, totalPoints: 0, newThisWeek: 0 }
const emptyViewCounts = { all: 0, pending: 0, admins: 0, internals: 0, portals: 0, archived: 0 }

function searchParams(params: Record<string, string> = {}) {
  return Promise.resolve(params)
}

const adminSession = { user: { id: "u1", role: "admin" } } as never

describe("AdminUsersPage query concurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(requireFeatureAccess).mockResolvedValue(adminSession)
    vi.mocked(getUsersPaginatedFromDb).mockResolvedValue({ users: [], total: 0 })
    vi.mocked(getUserStatsFromDb).mockResolvedValue(emptyStats)
    vi.mocked(getViewCountsFromDb).mockResolvedValue(emptyViewCounts)
    vi.mocked(getPushTokensByUserIds).mockResolvedValue({})
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Validates: the three queries run one at a time (not Promise.all), so the page never
  // holds more than one pooler connection open for its own calls at any given moment.
  it("queries the user list, then stats, then view counts — never concurrently", async () => {
    const order: string[] = []
    vi.mocked(getUsersPaginatedFromDb).mockImplementation(async () => {
      order.push("list")
      return { users: [], total: 0 }
    })
    vi.mocked(getUserStatsFromDb).mockImplementation(async () => {
      order.push("stats")
      return emptyStats
    })
    vi.mocked(getViewCountsFromDb).mockImplementation(async () => {
      order.push("viewCounts")
      return emptyViewCounts
    })

    await AdminUsersPage({ searchParams: searchParams() })
    expect(order).toEqual(["list", "stats", "viewCounts"])
  })

  // Validates: a hung view-counts query causes the render to reject once the timeout
  // elapses, instead of hanging forever — Next.js turns this rejection into the nearest
  // error.tsx boundary.
  it("rejects with QueryTimeoutError when a query hangs past the timeout", async () => {
    vi.useFakeTimers()
    vi.mocked(getViewCountsFromDb).mockReturnValue(new Promise(() => {}))

    const pagePromise = AdminUsersPage({ searchParams: searchParams() })
    const assertion = expect(pagePromise).rejects.toBeInstanceOf(QueryTimeoutError)
    await vi.advanceTimersByTimeAsync(6000)
    await assertion
  })
})
