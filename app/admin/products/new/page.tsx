import Link from "next/link"
import { ProductForm } from "@/features/products/components/ProductForm"
import { getAllCategories } from "@/features/categories/db/categories"
import { getCachedLaboratories } from "@/features/laboratory/db/cache/laboratory"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"

export default async function AdminProductsNewPage() {
  const [categories, laboratories] = await Promise.all([
    getAllCategories(),
    getCachedLaboratories(),
  ])

  return (
    <div className="container my-6 space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/products">
            <ChevronLeft className="size-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New Product</h1>
          <p className="text-muted-foreground text-sm">
            Add a new product to the marketplace
          </p>
        </div>
      </div>

      <ProductForm key="new" mode="create" categories={categories} laboratories={laboratories} />
    </div>
  )
}
