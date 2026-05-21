import Link from "next/link"
import { connection } from "next/server"
import { ChevronRight, Plus, Download } from "lucide-react"
import { getAdminProducts, getAdminProductCounts } from "@/features/products/db/cache/products"
import { ProductsListView } from "@/features/products/components/ProductsListView"
import type { ViewTab } from "@/components/admin/list-view"

const PAGE_SIZE = 25
const VIEWS = ["all", "pending", "featured", "collector", "sold", "drafts"] as const
type View = (typeof VIEWS)[number]

type Props = {
  searchParams: Promise<{ page?: string; view?: string }>
}

export default async function AdminProductsPage({ searchParams }: Props) {
  await connection()
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1)
  const view: View = (VIEWS as readonly string[]).includes(params.view ?? "")
    ? (params.view as View)
    : "all"

  const counts = await getAdminProductCounts()

  // Map view tab to DB filter params
  const viewFilter = {
    all:       {},
    pending:   { moderationStatus: "pending" as const },
    featured:  { isFeatured: true },
    collector: { isCollectorPiece: true },
    sold:      { status: "sold" as const },
    drafts:    { status: "hidden" as const },
  }[view]

  const { products, total } = await getAdminProducts({
    page,
    limit: PAGE_SIZE,
    ...viewFilter,
  })

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
          <button className="lv-export-btn">
            <Download /> Export Excel
          </button>
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
      />
    </div>
  )
}
