import { connection } from "next/server"
import { notFound } from "next/navigation"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { ProductForm } from "@/features/products/components/ProductForm"
import { getCachedProduct } from "@/features/products/db/cache/products"
import { getAllCategories } from "@/features/categories/db/categories"
import { getAllLaboratories } from "@/features/laboratory/db/laboratory"
import { getAllOrigins } from "@/features/origin/db/origin"
import { getFeatureSettings } from "@/features/points/db/points"
import { FadeUp } from "@/components/admin/motion"
import { resolveAdjacentProducts } from "./resolve-adjacent"

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
  }>
}

export default async function AdminProductsEditPage({ params, searchParams }: Props) {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.PRODUCTS)
  const { id } = await params
  const sp = await searchParams
  const back = sp.from ? (BACK_ROUTES[sp.from] ?? null) : null

  const [product, categories, laboratories, origins, featureSettings] = await Promise.all([
    getCachedProduct(id),
    getAllCategories(),
    getAllLaboratories(),
    getAllOrigins(),
    getFeatureSettings(),
  ])

  if (!product) notFound()

  const adjacent = await resolveAdjacentProducts(id, {
    view: sp.view,
    search: sp.search,
    page: sp.page,
    priceMinUSD: sp.priceMinUSD,
    priceMaxUSD: sp.priceMaxUSD,
    priceMinMMK: sp.priceMinMMK,
    priceMaxMMK: sp.priceMaxMMK,
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
