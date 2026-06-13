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

const BACK_ROUTES: Record<string, { href: string; label: string }> = {
  "collector-requests": {
    href: "/admin/collector-piece-show-requests",
    label: "Collector Requests",
  },
}

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}

export default async function AdminProductsEditPage({ params, searchParams }: Props) {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.PRODUCTS)
  const { id } = await params
  const { from } = await searchParams
  const back = from ? (BACK_ROUTES[from] ?? null) : null
  const product = await getCachedProduct(id)
  const categories = await getAllCategories()
  const laboratories = await getAllLaboratories()
  const origins = await getAllOrigins()
  const featureSettings = await getFeatureSettings()

  if (!product) notFound()

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
        />
      </div>
    </FadeUp>
  )
}
