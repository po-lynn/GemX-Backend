import Link from "next/link"
import { Suspense } from "react"
import { getAdminProducts } from "@/features/products/db/cache/products"
import {
  ProductFilters,
  ProductsSearchInput,
  ProductsTable,
} from "@/features/products/components"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { adminProductsSearchSchema } from "@/features/products/schemas/products"
import { getAllCategories } from "@/features/categories/db/categories"
import { getAllLaboratories } from "@/features/laboratory/db/laboratory"
import { getAllOrigins } from "@/features/origin/db/origin"
import { Plus } from "lucide-react"

type Props = {
  searchParams: Promise<{
    page?: string
    search?: string
    productType?: string
    categoryId?: string
    status?: string
    stoneCut?: string
    shape?: string
    origin?: string
    laboratoryId?: string
  }>
}

export default async function AdminProductsPage({ searchParams }: Props) {
  const params = await searchParams
  const parsed = adminProductsSearchSchema.parse({
    page: params.page,
    search: params.search,
    productType: params.productType,
    categoryId: params.categoryId,
    status: params.status,
    stoneCut: params.stoneCut,
    shape: params.shape,
    origin: params.origin,
    laboratoryId: params.laboratoryId,
  })
  const {
    page,
    search,
    productType,
    categoryId,
    status,
    stoneCut,
    shape,
    origin,
    laboratoryId,
  } = parsed

  const [categories, origins, laboratories, { products, total }] =
    await Promise.all([
      getAllCategories(),
      getAllOrigins(),
      getAllLaboratories(),
      getAdminProducts({
        page,
        limit: 20,
        search: search || undefined,
        productType: productType ?? undefined,
        categoryId: categoryId ?? undefined,
        status: status ?? undefined,
        stoneCut: stoneCut ?? undefined,
        shape: shape ?? undefined,
        origin: (origin?.trim() && origin) || undefined,
        laboratoryId: laboratoryId ?? undefined,
      }),
    ])

  const totalPages = Math.ceil(total / 20)
  const filterParams = {
    productType: productType ?? "",
    categoryId: categoryId ?? "",
    status: status ?? "",
    stoneCut: stoneCut ?? "",
    shape: shape ?? "",
    origin: origin ?? "",
    laboratoryId: laboratoryId ?? "",
  }

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
          <Suspense fallback={null}>
            <ProductFilters
              categories={categories}
              origins={origins}
              laboratories={laboratories}
              productType={filterParams.productType}
              categoryId={filterParams.categoryId}
              status={filterParams.status}
              stoneCut={filterParams.stoneCut}
              shape={filterParams.shape}
              origin={filterParams.origin}
              laboratoryId={filterParams.laboratoryId}
            />
          </Suspense>
        </CardHeader>
        <CardContent>
          <ProductsTable
            products={products}
            page={page}
            totalPages={totalPages}
            search={search ?? ""}
            productType={filterParams.productType}
            categoryId={filterParams.categoryId}
            status={filterParams.status}
            stoneCut={filterParams.stoneCut}
            shape={filterParams.shape}
            origin={filterParams.origin}
            laboratoryId={filterParams.laboratoryId}
          />
        </CardContent>
      </Card>
    </div>
  )
}
