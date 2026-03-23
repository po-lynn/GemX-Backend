import { connection } from "next/server"
import { ProductForm } from "@/features/products/components/ProductForm"
import { getAllCategories } from "@/features/categories/db/categories"
import { getAllLaboratories } from "@/features/laboratory/db/laboratory"
import { getAllOrigins } from "@/features/origin/db/origin"
import { getFeatureSettings } from "@/features/points/db/points"

export default async function AdminProductsNewPage() {
  await connection()
  const categories = await getAllCategories()
  const laboratories = await getAllLaboratories()
  const origins = await getAllOrigins()
  const featureSettings = await getFeatureSettings()

  return (
    <div className="gem-theme product-form-page container my-4 w-full max-w-screen-2xl space-y-6 md:my-6">
      <ProductForm
        key="new"
        mode="create"
        categories={categories}
        laboratories={laboratories}
        origins={origins}
        featurePricingTiers={featureSettings.pricingTiers}
      />
    </div>
  )
}
