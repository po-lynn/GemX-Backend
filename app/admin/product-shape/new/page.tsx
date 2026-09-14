import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { ProductShapeForm } from "@/features/product-shape/components"
import { FadeUp } from "@/components/admin/motion"

export default async function AdminProductShapeNewPage() {
  await requireFeatureAccess(FEATURE_KEYS.PRODUCT_SHAPE)
  return (
    <FadeUp>
      <ProductShapeForm key="create" mode="create" />
    </FadeUp>
  )
}
