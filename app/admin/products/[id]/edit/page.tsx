import Link from "next/link"
import { connection } from "next/server"
import { notFound } from "next/navigation"
import { ProductForm } from "@/features/products/components/ProductForm"
import { getCachedProduct } from "@/features/products/db/cache/products"
import { getAllCategories } from "@/features/categories/db/categories"
import { getAllLaboratories } from "@/features/laboratory/db/laboratory"
import { getAllOrigins } from "@/features/origin/db/origin"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"

type Props = {
  params: Promise<{ id: string }>
}

export default async function AdminProductsEditPage({ params }: Props) {
  await connection()
  const { id } = await params
  // Sequential to avoid hang with Transaction pooler (6543).
  const product = await getCachedProduct(id)
  const categories = await getAllCategories()
  const laboratories = await getAllLaboratories()
  const origins = await getAllOrigins()

  if (!product) notFound()

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
          <h1 className="text-2xl font-semibold tracking-tight">
            Edit Product
          </h1>
          <p className="text-muted-foreground text-sm">{product.title}</p>
        </div>
      </div>

      <ProductForm key={product.id} mode="edit" product={product} categories={categories} laboratories={laboratories} origins={origins} />
    </div>
  )
}
