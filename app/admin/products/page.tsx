import Link from "next/link"
import { connection } from "next/server"
import { ChevronRight, Plus, Download } from "lucide-react"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { getAdminProductsFromDb, getAdminProductCountsFromDb, getAdminProductFacetCounts } from "@/features/products/db/products"
import { ProductsListView } from "@/features/products/components/ProductsListView"
import type { ViewTab } from "@/components/admin/list-view"
import { FadeUp, PressButton } from "@/components/admin/motion"

const PAGE_SIZE = 25
const VIEWS = ["all", "pending", "featured", "collector", "sold", "drafts"] as const
type View = (typeof VIEWS)[number]

const STONE_CUTS = ["Faceted", "Cabochon"] as const
const METALS = ["Gold", "Silver", "Other"] as const
const SHAPES = ["Oval", "Cushion", "Round", "Pear", "Heart"] as const
const IDENTIFICATIONS = ["Natural", "Heat Treated", "Treatments", "Others"] as const
const PRODUCT_TYPES = ["loose_stone", "jewellery"] as const
const MODERATION_STATUSES = ["pending", "approved", "rejected"] as const
const FLAG_VALUES = ["featured", "collector", "privilege"] as const

/** Parses a comma-separated URL param into distinct values from `allowed`, dropping anything else. */
function parseMultiParam<T extends string>(raw: string | undefined, allowed: readonly T[]): T[] {
  if (!raw) return []
  const set = new Set(allowed as readonly string[])
  const seen = new Set<T>()
  for (const v of raw.split(",")) {
    const trimmed = v.trim()
    if (set.has(trimmed)) seen.add(trimmed as T)
  }
  return [...seen]
}

/** Parses a comma-separated list of category ids — no allow-list validation possible without a DB round-trip. */
function parseCategoryIds(raw: string | undefined): string[] {
  if (!raw) return []
  const seen = new Set<string>()
  for (const v of raw.split(",")) {
    const trimmed = v.trim()
    if (trimmed) seen.add(trimmed)
  }
  return [...seen]
}

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
    stoneCut?: string
    metal?: string
    shape?: string
    identification?: string
    weightMin?: string
    weightMax?: string
    type?: string
    category?: string
    moderation?: string
    flags?: string
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
  const weightMin = parsePrice(params.weightMin)
  const weightMax = parsePrice(params.weightMax)

  const stoneCut = (STONE_CUTS as readonly string[]).includes(params.stoneCut ?? "")
    ? (params.stoneCut as (typeof STONE_CUTS)[number])
    : undefined
  const metal = (METALS as readonly string[]).includes(params.metal ?? "")
    ? (params.metal as (typeof METALS)[number])
    : undefined
  const shape = (SHAPES as readonly string[]).includes(params.shape ?? "")
    ? (params.shape as (typeof SHAPES)[number])
    : undefined
  const identification = (IDENTIFICATIONS as readonly string[]).includes(params.identification ?? "")
    ? (params.identification as (typeof IDENTIFICATIONS)[number])
    : undefined

  const productTypes = parseMultiParam(params.type, PRODUCT_TYPES)
  const categoryIds = parseCategoryIds(params.category)
  const moderationStatuses = parseMultiParam(params.moderation, MODERATION_STATUSES)
  const flags = parseMultiParam(params.flags, FLAG_VALUES)
  const flagsFilter = {
    ...(flags.includes("featured") ? { isFeatured: true } : {}),
    ...(flags.includes("collector") ? { isCollectorPiece: true } : {}),
    ...(flags.includes("privilege") ? { isPrivilegeAssist: true } : {}),
  }

  const viewFilter = {
    all:       statusFilter === "archive"
                 ? { status: "archive" as const }
                 : { excludeStatuses: ["archive", "draft"] as const },
    pending:   { moderationStatus: "pending" as const, excludeStatuses: ["archive", "draft"] as const },
    featured:  { isFeatured: true, excludeStatuses: ["archive", "draft"] as const },
    collector: { isCollectorPiece: true, excludeStatuses: ["archive", "draft"] as const },
    sold:      { status: "sold" as const },
    drafts:    { status: "draft" as const },
  }[view]

  const facetOpts = {
    search,
    ...viewFilter,
    ...flagsFilter,
    productTypes,
    categoryIds,
    moderationStatuses,
    priceMinUSD,
    priceMaxUSD,
    priceMinMMK,
    priceMaxMMK,
    stoneCut,
    metal,
    shape,
    identification,
    weightMin,
    weightMax,
  }

  const [counts, { products, total }, facetCounts] = await Promise.all([
    getAdminProductCountsFromDb(),
    getAdminProductsFromDb({
      page,
      limit: PAGE_SIZE,
      ...facetOpts,
    }),
    getAdminProductFacetCounts(facetOpts),
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
        facetCounts={facetCounts}
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
        stoneCut={stoneCut}
        metal={metal}
        shape={shape}
        identification={identification}
        weightMin={weightMin !== undefined ? String(weightMin) : undefined}
        weightMax={weightMax !== undefined ? String(weightMax) : undefined}
        productTypes={productTypes}
        categoryIds={categoryIds}
        moderationStatuses={moderationStatuses}
        flags={flags}
      />
    </div>
    </FadeUp>
  )
}
