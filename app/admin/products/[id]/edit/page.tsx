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
  const session = await requireFeatureAccess(FEATURE_KEYS.PRODUCTS)
  const { id } = await params
  const sp = await searchParams
  const back = sp.from ? (BACK_ROUTES[sp.from] ?? null) : null

  const canVerify =
    session.user.role === "admin" ||
    (session.user.role === "internal" &&
      (await checkInternalAccess(session.user.id, FEATURE_KEYS.PRODUCTS_VERIFY)))

  const [product, categories, laboratories, origins, featureSettings, companySettings] = await Promise.all([
    getProductById(id),
    getAllCategories(),
    getAllLaboratories(),
    getAllOrigins(),
    getFeatureSettings(),
    getCompanySettings(),
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
