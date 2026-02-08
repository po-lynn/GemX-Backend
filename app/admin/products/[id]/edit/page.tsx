import Link from "next/link"
import { notFound } from "next/navigation"
import { ProductForm } from "@/features/products/components/ProductForm"
import {
  getCachedProduct,
  getCachedCategoriesTree,
  getCachedSpeciesByCategoryMap,
} from "@/features/products/db/cache/products"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"

type Props = {
  params: Promise<{ id: string }>
}

export default async function AdminProductsEditPage({ params }: Props) {
  const { id } = await params
  const [product, categoryTree, speciesByCategory] = await Promise.all([
    getCachedProduct(id),
    getCachedCategoriesTree(),
    getCachedSpeciesByCategoryMap(),
  ])

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

      <ProductForm
          key={product.id}
          mode="edit"
          product={product}
          categoryTree={categoryTree}
          speciesByCategory={speciesByCategory}
        />
    </div>
  )
}
