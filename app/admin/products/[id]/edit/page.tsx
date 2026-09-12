import { connection } from "next/server"
import { notFound } from "next/navigation"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { checkInternalAccess } from "@/features/rbac/db/permissions"
import { ProductForm } from "@/features/products/components/ProductForm"
import { getProductById } from "@/features/products/db/products"
import { getAllCategories } from "@/features/categories/db/categories"
import { getAllLaboratories } from "@/features/laboratory/db/laboratory"
import { getAllOrigins } from "@/features/origin/db/origin"
import { getFeatureSettings } from "@/features/points/db/points"
import { getCompanySettings } from "@/features/company-settings/db/company-settings"
import { FadeUp } from "@/components/admin/motion"
import { resolveAdjacentProducts } from "./resolve-adjacent"
import { withQueryTimeout } from "@/lib/query-timeout"

/** Vercel backstop: if a query hangs past this, the platform kills the render instead of it hanging on the shared connection pool indefinitely. */
export const maxDuration = 10

const ADMIN_PRODUCT_EDIT_QUERY_TIMEOUT_MS = 6000

const BACK_ROUTES: Record<string, { href: string; label: string }> = {
  "collector-requests": {
    href: "/admin/collector-piece-show-requests",
    label: "Collector Requests",
  },
}

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    from?: string
    view?: string
    search?: string
    page?: string
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

export default async function AdminProductsEditPage({ params, searchParams }: Props) {
  await connection()
  const session = await requireFeatureAccess(FEATURE_KEYS.PRODUCTS)
  const { id } = await params
  const sp = await searchParams
  const back = sp.from ? (BACK_ROUTES[sp.from] ?? null) : null

  const canVerify =
    session.user.role === "admin" ||
    (session.user.role === "internal" &&
      (await checkInternalAccess(session.user.id, FEATURE_KEYS.PRODUCTS_VERIFY)))

  // Sequential, not Promise.all: this was the worst fan-out in the codebase (6 concurrent
  // queries on every edit-page load), enough to exceed Supabase's shared pooler connection
  // limit under real traffic — same root cause as app/admin/products/page.tsx (see
  // docs/technical/connection-pool-hardening.md). The record being edited and its dropdown/
  // config data are all required for the form to function, so every call is timeout-guarded
  // and allowed to throw — caught by this route's existing error.tsx.
  const product = await withQueryTimeout(
    getProductById(id),
    ADMIN_PRODUCT_EDIT_QUERY_TIMEOUT_MS,
    "admin-product-edit-product"
  )
  const categories = await withQueryTimeout(
    getAllCategories(),
    ADMIN_PRODUCT_EDIT_QUERY_TIMEOUT_MS,
    "admin-product-edit-categories"
  )
  const laboratories = await withQueryTimeout(
    getAllLaboratories(),
    ADMIN_PRODUCT_EDIT_QUERY_TIMEOUT_MS,
    "admin-product-edit-laboratories"
  )
  const origins = await withQueryTimeout(
    getAllOrigins(),
    ADMIN_PRODUCT_EDIT_QUERY_TIMEOUT_MS,
    "admin-product-edit-origins"
  )
  const featureSettings = await withQueryTimeout(
    getFeatureSettings(),
    ADMIN_PRODUCT_EDIT_QUERY_TIMEOUT_MS,
    "admin-product-edit-feature-settings"
  )
  const companySettings = await withQueryTimeout(
    getCompanySettings(),
    ADMIN_PRODUCT_EDIT_QUERY_TIMEOUT_MS,
    "admin-product-edit-company-settings"
  )

  if (!product) notFound()

  const adjacent = await resolveAdjacentProducts(id, {
    view: sp.view,
    search: sp.search,
    page: sp.page,
    priceMinUSD: sp.priceMinUSD,
    priceMaxUSD: sp.priceMaxUSD,
    priceMinMMK: sp.priceMinMMK,
    priceMaxMMK: sp.priceMaxMMK,
    stoneCut: sp.stoneCut,
    metal: sp.metal,
    shape: sp.shape,
    identification: sp.identification,
    weightMin: sp.weightMin,
    weightMax: sp.weightMax,
    type: sp.type,
    category: sp.category,
    moderation: sp.moderation,
    flags: sp.flags,
  })

  return (
    <FadeUp>
      <div className="py-2">
        <ProductForm
          key={product.id}
          mode="edit"
          product={product}
          categories={categories}
          laboratories={laboratories}
          origins={origins}
          featurePricingTiers={featureSettings.pricingTiers}
          companyUserId={companySettings?.companyUserId ?? null}
          canVerify={canVerify}
          backHref={back?.href}
          backLabel={back?.label}
          prevHref={adjacent.prevHref}
          nextHref={adjacent.nextHref}
          listPosition={adjacent.position}
          listTotal={adjacent.total}
        />
      </div>
    </FadeUp>
  )
}
