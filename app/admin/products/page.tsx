import Link from "next/link"
import { Suspense } from "react"
import { getAdminProducts } from "@/features/products/db/cache/products"
import { ProductsSearchInput, ProductsTable } from "@/features/products/components"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { adminProductsSearchSchema } from "@/features/products/schemas/products"
import { Plus } from "lucide-react"

type Props = {
  searchParams: Promise<{ page?: string; search?: string }>
}

export default async function AdminProductsPage({ searchParams }: Props) {
  const params = await searchParams
  const { page, search } = adminProductsSearchSchema.parse({
    page: params.page,
    search: params.search,
  })

  const { products, total } = await getAdminProducts({
    page,
    limit: 20,
    search: search || undefined,
  })

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="container my-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-muted-foreground text-sm">
            Manage products, moderation, and featured status
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/products/new">
            <Plus className="mr-2 size-4" />
            New Product
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Products</CardTitle>
          <CardDescription>
            {total} product{total !== 1 ? "s" : ""} total
          </CardDescription>
          <Suspense fallback={null}>
            <ProductsSearchInput defaultValue={search ?? ""} />
          </Suspense>
        </CardHeader>
        <CardContent>
          <ProductsTable
            products={products}
            page={page}
            totalPages={totalPages}
            search={search ?? ""}
          />
        </CardContent>
      </Card>
    </div>
  )
}
