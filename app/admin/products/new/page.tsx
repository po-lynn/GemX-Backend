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
    <div className="gem-theme product-form-page container my-4 w-full max-w-screen-2xl space-y-6 md:my-6">
      <ProductForm key="new" mode="create" categories={categories} laboratories={laboratories} origins={origins} />
    </div>
  )
}
