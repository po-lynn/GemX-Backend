import { connection } from "next/server"
import { notFound } from "next/navigation"
import { ProductForm } from "@/features/products/components/ProductForm"
import { getCachedProduct } from "@/features/products/db/cache/products"
import { getProductFormPagination } from "@/features/products/db/products"
import { getAllCategories } from "@/features/categories/db/categories"
import { getAllLaboratories } from "@/features/laboratory/db/laboratory"
import { getAllOrigins } from "@/features/origin/db/origin"

type Props = {
  params: Promise<{ id: string }>
}

export default async function AdminProductsEditPage({ params }: Props) {
  await connection()
  const { id } = await params
  const [product, pagination] = await Promise.all([
    getCachedProduct(id),
    getProductFormPagination(id),
  ])
  const categories = await getAllCategories()
  const laboratories = await getAllLaboratories()
  const origins = await getAllOrigins()

  if (!product) notFound()

  return (
    <div className="gem-theme container my-6 space-y-6">
      <ProductForm
        key={product.id}
        mode="edit"
        product={product}
        categories={categories}
        laboratories={laboratories}
        origins={origins}
        pagination={pagination ?? undefined}
      />
    </div>
  )
}
