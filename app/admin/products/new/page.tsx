import Link from "next/link"
import { connection } from "next/server"
import { ProductForm } from "@/features/products/components/ProductForm"
import { getAllCategories } from "@/features/categories/db/categories"
import { getAllLaboratories } from "@/features/laboratory/db/laboratory"
import { getAllOrigins } from "@/features/origin/db/origin"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"

export default async function AdminProductsNewPage() {
  await connection()
  // Sequential to avoid hang with Transaction pooler (6543).
  const categories = await getAllCategories()
  const laboratories = await getAllLaboratories()
  const origins = await getAllOrigins()

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

      <ProductForm key="new" mode="create" categories={categories} laboratories={laboratories} origins={origins} />
    </div>
  )
}
