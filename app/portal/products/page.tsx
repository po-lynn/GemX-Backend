import { connection } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import Link from "next/link"
import { Plus } from "lucide-react"
import { getPortalProductCounts } from "@/features/products/db/cache/products"
import { getProductsBySellerId } from "@/features/products/db/products"
import { PortalProductsListView } from "@/features/products/components"
import type { ViewTab } from "@/components/admin/list-view"

const PAGE_SIZE = 25
const VIEWS = ["all", "pending", "featured", "collector", "sold", "drafts"] as const
type View = (typeof VIEWS)[number]

type Props = {
  searchParams: Promise<{
    page?: string
    view?: string
    search?: string
    priceMinUSD?: string
    priceMaxUSD?: string
    priceMinMMK?: string
    priceMaxMMK?: string
  }>
}

export default async function PortalProductsPage({ searchParams }: Props) {
  await connection()
  const session = await auth.api.getSession({ headers: await headers() })
  const userId = session!.user.id
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1)
  const search = params.search?.trim() || undefined
  const view: View = (VIEWS as readonly string[]).includes(params.view ?? "")
    ? (params.view as View)
    : "all"

  function parsePrice(raw: string | undefined): number | undefined {
    if (!raw) return undefined
    const n = Number(raw)
    return isFinite(n) && n >= 0 ? n : undefined
  }

  const priceMinUSD = parsePrice(params.priceMinUSD)
  const priceMaxUSD = parsePrice(params.priceMaxUSD)
  const priceMinMMK = parsePrice(params.priceMinMMK)
  const priceMaxMMK = parsePrice(params.priceMaxMMK)

  const viewFilter = {
    all:       {} as const,
    pending:   { moderationStatus: "pending" as const },
    featured:  { isFeatured: true as const },
    collector: { isCollectorPiece: true as const },
    sold:      { status: "sold" as const },
    drafts:    { status: "hidden" as const },
  }[view]

  const [counts, { products, total }] = await Promise.all([
    getPortalProductCounts(userId),
    getProductsBySellerId(userId, {
      page,
      limit: PAGE_SIZE,
      search,
      ...viewFilter,
      sortBy: "createdAt",
      sortOrder: "desc",
    }),
  ])

  const views: ViewTab[] = [
    { id: "all",       label: "All",       count: counts.all },
    { id: "pending",   label: "Pending",   count: counts.pending },
    { id: "featured",  label: "Featured",  count: counts.featured },
    { id: "collector", label: "Collector", count: counts.collector },
    { id: "sold",      label: "Sold",      count: counts.sold },
    { id: "drafts",    label: "Drafts",    count: counts.drafts },
  ]

  return (
    <div className="py-2">
      <div className="lv-pagehead">
        <div>
          <h1 className="lv-h1">
            My Products
            <span className="lv-h1-count">{counts.all.toLocaleString()} total</span>
          </h1>
          <p className="lv-subhead">Manage your gemstone &amp; jewellery listings.</p>
        </div>
        <div className="lv-pagehead-actions">
          <Link href="/portal/products/new" className="lv-new-btn">
            <Plus /> New Product
          </Link>
        </div>
      </div>

      <PortalProductsListView
        products={products}
        views={views}
        activeView={view}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        search={search}
        priceMinUSD={priceMinUSD !== undefined ? String(priceMinUSD) : undefined}
        priceMaxUSD={priceMaxUSD !== undefined ? String(priceMaxUSD) : undefined}
        priceMinMMK={priceMinMMK !== undefined ? String(priceMinMMK) : undefined}
        priceMaxMMK={priceMaxMMK !== undefined ? String(priceMaxMMK) : undefined}
      />
    </div>
  )
}
