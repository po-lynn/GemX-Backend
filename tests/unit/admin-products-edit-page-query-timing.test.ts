import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { checkInternalAccess } from "@/features/rbac/db/permissions"
import { getProductById } from "@/features/products/db/products"
import { getAllCategories } from "@/features/categories/db/categories"
import { getAllLaboratories } from "@/features/laboratory/db/laboratory"
import { getAllOrigins } from "@/features/origin/db/origin"
import { getFeatureSettings } from "@/features/points/db/points"
import { getCompanySettings } from "@/features/company-settings/db/company-settings"
import { resolveAdjacentProducts } from "@/app/admin/products/[id]/edit/resolve-adjacent"
import { QueryTimeoutError } from "@/lib/query-timeout"
import AdminProductsEditPage from "@/app/admin/products/[id]/edit/page"

// Regression test mirroring tests/unit/admin-products-page-query-timing.test.ts: this page
// used a 6-way Promise.all (product, categories, laboratories, origins, feature settings,
// company settings) — the worst fan-out found in the codebase — with no timeout, matching
// the same stuck-loading-skeleton root cause as app/admin/products/page.tsx. Verifies the
// calls now run sequentially and are timeout-guarded.

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND") }) }))
vi.mock("@/lib/admin-guard", () => ({ requireFeatureAccess: vi.fn() }))
vi.mock("@/features/rbac/db/permissions", () => ({ checkInternalAccess: vi.fn() }))
vi.mock("@/features/products/db/products", () => ({ getProductById: vi.fn() }))
vi.mock("@/features/categories/db/categories", () => ({ getAllCategories: vi.fn() }))
vi.mock("@/features/laboratory/db/laboratory", () => ({ getAllLaboratories: vi.fn() }))
vi.mock("@/features/origin/db/origin", () => ({ getAllOrigins: vi.fn() }))
vi.mock("@/features/points/db/points", () => ({ getFeatureSettings: vi.fn() }))
vi.mock("@/features/company-settings/db/company-settings", () => ({ getCompanySettings: vi.fn() }))
vi.mock("@/app/admin/products/[id]/edit/resolve-adjacent", () => ({ resolveAdjacentProducts: vi.fn() }))
vi.mock("@/features/products/components/ProductForm", () => ({ ProductForm: () => null }))
vi.mock("@/components/admin/motion", () => ({
  FadeUp: ({ children }: { children: React.ReactNode }) => children,
}))

const fakeProduct = { id: "p1" } as never
const adjacentFallback = { prevHref: null, nextHref: null, position: null, total: null }

function params(id = "p1") {
  return Promise.resolve({ id })
}

function searchParams(sp: Record<string, string> = {}) {
  return Promise.resolve(sp)
}

const adminSession = { user: { id: "u1", role: "admin" } } as never

describe("AdminProductsEditPage query concurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(requireFeatureAccess).mockResolvedValue(adminSession)
    vi.mocked(checkInternalAccess).mockResolvedValue(false as never)
    vi.mocked(getProductById).mockResolvedValue(fakeProduct)
    vi.mocked(getAllCategories).mockResolvedValue([] as never)
    vi.mocked(getAllLaboratories).mockResolvedValue([] as never)
    vi.mocked(getAllOrigins).mockResolvedValue([] as never)
    vi.mocked(getFeatureSettings).mockResolvedValue({ homeFeaturedLimit: 5, pricingTiers: [] } as never)
    vi.mocked(getCompanySettings).mockResolvedValue(null)
    vi.mocked(resolveAdjacentProducts).mockResolvedValue(adjacentFallback)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Validates: the six queries run one at a time (not Promise.all), so the page never
  // holds more than one pooler connection open for its own calls at any given moment.
  it("queries product, categories, laboratories, origins, feature settings, then company settings — never concurrently", async () => {
    const order: string[] = []
    vi.mocked(getProductById).mockImplementation(async () => { order.push("product"); return fakeProduct })
    vi.mocked(getAllCategories).mockImplementation(async () => { order.push("categories"); return [] as never })
    vi.mocked(getAllLaboratories).mockImplementation(async () => { order.push("laboratories"); return [] as never })
    vi.mocked(getAllOrigins).mockImplementation(async () => { order.push("origins"); return [] as never })
    vi.mocked(getFeatureSettings).mockImplementation(async () => { order.push("featureSettings"); return { homeFeaturedLimit: 5, pricingTiers: [] } as never })
    vi.mocked(getCompanySettings).mockImplementation(async () => { order.push("companySettings"); return null })

    await AdminProductsEditPage({ params: params(), searchParams: searchParams() })
    expect(order).toEqual(["product", "categories", "laboratories", "origins", "featureSettings", "companySettings"])
  })

  // Validates: a hung getProductById query — the primary record being edited — causes the
  // render to reject once the timeout elapses, instead of hanging forever. Next.js turns
  // this rejection into this route's existing error.tsx boundary.
  it("rejects with QueryTimeoutError when the product query hangs past the timeout", async () => {
    vi.useFakeTimers()
    vi.mocked(getProductById).mockReturnValue(new Promise(() => {}))

    const pagePromise = AdminProductsEditPage({ params: params(), searchParams: searchParams() })
    const assertion = expect(pagePromise).rejects.toBeInstanceOf(QueryTimeoutError)
    await vi.advanceTimersByTimeAsync(6000)
    await assertion
  })
})
