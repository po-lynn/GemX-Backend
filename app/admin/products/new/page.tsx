import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { checkInternalAccess } from "@/features/rbac/db/permissions"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { ProductForm } from "@/features/products/components/ProductForm"
import { getAllCategories } from "@/features/categories/db/categories"
import { getAllLaboratories } from "@/features/laboratory/db/laboratory"
import { getAllOrigins } from "@/features/origin/db/origin"
import { getAllColors } from "@/features/colors/db/color"
import { getFeatureSettings } from "@/features/points/db/points"
import { FadeUp } from "@/components/admin/motion"

export default async function AdminProductsNewPage() {
  await connection()
  const session = await requireFeatureAccess(FEATURE_KEYS.PRODUCTS)
  const canVerify =
    session.user.role === "admin" ||
    (session.user.role === "internal" &&
      (await checkInternalAccess(session.user.id, FEATURE_KEYS.PRODUCTS_VERIFY)))
  const categories = await getAllCategories()
  const laboratories = await getAllLaboratories()
  const origins = await getAllOrigins()
  const colors = await getAllColors()
  const featureSettings = await getFeatureSettings()

  return (
    <FadeUp>
      <div className="gem-theme product-form-page container my-4 w-full max-w-screen-2xl space-y-6 md:my-6">
        <ProductForm
          key="new"
          mode="create"
          categories={categories}
          laboratories={laboratories}
          origins={origins}
          colors={colors}
          featurePricingTiers={featureSettings.pricingTiers}
          canVerify={canVerify}
        />
      </div>
    </FadeUp>
  )
}
