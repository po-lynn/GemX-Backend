import { connection } from "next/server"
import { ProductForm } from "@/features/products/components/ProductForm"
import { getAllCategories } from "@/features/categories/db/categories"
import { getAllLaboratories } from "@/features/laboratory/db/laboratory"
import { getAllOrigins } from "@/features/origin/db/origin"

export default async function AdminProductsNewPage() {
  await connection()
  const categories = await getAllCategories()
  const laboratories = await getAllLaboratories()
  const origins = await getAllOrigins()

  return (
    <div className="gem-theme container my-6 space-y-6">
      <ProductForm key="new" mode="create" categories={categories} laboratories={laboratories} origins={origins} />
    </div>
  )
}
