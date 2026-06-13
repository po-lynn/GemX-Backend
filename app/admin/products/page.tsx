import Link from "next/link"
import { connection } from "next/server"
import { ChevronRight, Plus, Download } from "lucide-react"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { getAdminProducts, getAdminProductCounts } from "@/features/products/db/cache/products"
import { ProductsListView } from "@/features/products/components/ProductsListView"
import type { ViewTab } from "@/components/admin/list-view"
import { FadeUp, PressButton } from "@/components/admin/motion"

const PAGE_SIZE = 25
const VIEWS = ["all", "pending", "featured", "collector", "sold", "drafts"] as const
type View = (typeof VIEWS)[number]

type Props = {
  searchParams: Promise<{
    page?: string
    view?: string
    search?: string
    status?: string
    priceMinUSD?: string
    priceMaxUSD?: string
    priceMinMMK?: string
    priceMaxMMK?: string
  }>
}

export default async function AdminProductsPage({ searchParams }: Props) {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.PRODUCTS)
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1)
  const search = params.search?.trim() || undefined
  const view: View = (VIEWS as readonly string[]).includes(params.view ?? "")
    ? (params.view as View)
    : "all"
  const statusFilter = params.status?.trim() || undefined

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
    all:       statusFilter === "archive"
                 ? { status: "archive" as const }
                 : { excludeStatuses: ["archive"] as const },
    pending:   { moderationStatus: "pending" as const },
    featured:  { isFeatured: true },
    collector: { isCollectorPiece: true },
    sold:      { status: "sold" as const },
    drafts:    { status: "hidden" as const },
  }[view]

  const [counts, { products, total }] = await Promise.all([
    getAdminProductCounts(),
    getAdminProducts({
      page,
      limit: PAGE_SIZE,
      search,
      ...viewFilter,
      priceMinUSD,
      priceMaxUSD,
      priceMinMMK,
      priceMaxMMK,
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
    <FadeUp>
    <div className="py-2">
      <div className="lv-pagehead">
        <div>
          <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/admin">Admin</Link>
            <ChevronRight />
            <Link href="/admin/products">Catalog</Link>
            <ChevronRight />
            <span className="lv-here">Products</span>
          </nav>
          <h1 className="lv-h1">
            Products
            <span className="lv-h1-count">{counts.all.toLocaleString()} total</span>
          </h1>
          <p className="lv-subhead">
            Gemstones &amp; jewellery — manage listings, moderation, and visibility.
          </p>
        </div>
        <div className="lv-pagehead-actions">
          <PressButton className="lv-export-btn">
            <Download /> Export Excel
          </PressButton>
          <Link href="/admin/products/new" className="lv-new-btn">
            <Plus /> New Product
          </Link>
        </div>
      </div>

      <ProductsListView
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
    </FadeUp>
  )
}
