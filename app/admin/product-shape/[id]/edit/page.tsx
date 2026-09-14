import { Suspense } from "react"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { ProductShapeForm } from "@/features/product-shape/components"
import { getCachedProductShapeById } from "@/features/product-shape/db/cache/product-shape"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { FadeUp } from "@/components/admin/motion"

type Props = {
  params: Promise<{ id: string }>
}

async function AdminProductShapeEditContent({ params }: Props) {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.PRODUCT_SHAPE)
  const { id } = await params
  const productShape = await getCachedProductShapeById(id)
  if (!productShape) notFound()

  return (
    <ProductShapeForm
      key={productShape.id}
      mode="edit"
      productShape={productShape}
    />
  )
}

export default function AdminProductShapeEditPage(props: Props) {
  return (
    <FadeUp>
      <Suspense
        fallback={
          <div className="animate-pulse space-y-5 py-2">
            <div className="h-8 w-48 rounded-lg bg-slate-200" />
            <div className="h-64 rounded-xl bg-white ring-1 ring-slate-200/60" />
          </div>
        }
      >
        <AdminProductShapeEditContent {...props} />
      </Suspense>
    </FadeUp>
  )
}
