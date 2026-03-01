import Link from "next/link"
import { connection } from "next/server"
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
import {
  adminProductsSearchSchema,
  ADMIN_PRODUCTS_PAGE_SIZE,
} from "@/features/products/schemas/products"
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
    createdFrom?: string
    createdTo?: string
    sortBy?: string
    sortOrder?: string
    isFeatured?: string
    isCollectorPiece?: string
    isPrivilegeAssist?: string
  }>
}

export default async function AdminProductsPage({ searchParams }: Props) {
  await connection()
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
    createdFrom: params.createdFrom?.trim() || undefined,
    createdTo: params.createdTo?.trim() || undefined,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    isFeatured: params.isFeatured,
    isCollectorPiece: params.isCollectorPiece,
    isPrivilegeAssist: params.isPrivilegeAssist,
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
    createdFrom,
    createdTo,
    sortBy,
    sortOrder,
    isFeatured,
    isCollectorPiece,
    isPrivilegeAssist,
  } = parsed

  // With Transaction pooler (6543), avoid concurrent queries on the single connection to prevent hang.
  const categories = await getAllCategories()
  const origins = await getAllOrigins()
  const laboratories = await getAllLaboratories()

  const limit = ADMIN_PRODUCTS_PAGE_SIZE
  const { products, total } = await getAdminProducts({
    page,
    limit,
    search: search || undefined,
    productType: productType ?? undefined,
    categoryId: categoryId ?? undefined,
    status: status ?? undefined,
    stoneCut: stoneCut ?? undefined,
    shape: shape ?? undefined,
    origin: (origin?.trim() && origin) || undefined,
    laboratoryId: laboratoryId ?? undefined,
    createdFrom: createdFrom ?? undefined,
    createdTo: createdTo ?? undefined,
    sortBy: sortBy ?? undefined,
    sortOrder: sortOrder ?? undefined,
    isFeatured: isFeatured ?? undefined,
    isCollectorPiece: isCollectorPiece ?? undefined,
    isPrivilegeAssist: isPrivilegeAssist ?? undefined,
  })

  const totalPages = Math.ceil(total / limit)
  const filters = {
    search: search ?? "",
    productType: productType ?? "",
    categoryId: categoryId ?? "",
    status: status ?? "",
    stoneCut: stoneCut ?? "",
    shape: shape ?? "",
    origin: origin ?? "",
    laboratoryId: laboratoryId ?? "",
    createdFrom: createdFrom ?? "",
    createdTo: createdTo ?? "",
    sortBy: sortBy ?? "createdAt",
    sortOrder: sortOrder ?? "desc",
    isFeatured: isFeatured === true ? "true" : "",
    isCollectorPiece: isCollectorPiece === true ? "true" : "",
    isPrivilegeAssist: isPrivilegeAssist === true ? "true" : "",
  }

  return (
    <div className="gem-theme container my-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Products
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gemstones & jewellery — manage listings, moderation, and status
          </p>
        </div>
        <Button asChild className="shadow-sm">
          <Link href="/admin/products/new">
            <Plus className="mr-2 size-4" />
            New Product
          </Link>
        </Button>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="space-y-4 border-b border-border pb-6">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-lg">All Products</CardTitle>
            <CardDescription>
              {total} product{total !== 1 ? "s" : ""} total
            </CardDescription>
          </div>
          <div className="gem-search-bar flex flex-wrap items-center gap-4 p-4">
            <Suspense fallback={null}>
              <ProductsSearchInput defaultValue={filters.search} />
            </Suspense>
            <Suspense fallback={null}>
              <ProductFilters
                categories={categories}
                origins={origins}
                laboratories={laboratories}
                productType={filters.productType}
                categoryId={filters.categoryId}
                status={filters.status}
                stoneCut={filters.stoneCut}
                shape={filters.shape}
                origin={filters.origin}
                laboratoryId={filters.laboratoryId}
                createdFrom={filters.createdFrom}
                createdTo={filters.createdTo}
                isFeatured={filters.isFeatured === "true"}
                isCollectorPiece={filters.isCollectorPiece === "true"}
                isPrivilegeAssist={filters.isPrivilegeAssist === "true"}
              />
            </Suspense>
          </div>
        </CardHeader>
        <CardContent className="px-0 pt-0">
          <ProductsTable
            products={products}
            page={page}
            totalPages={totalPages}
            total={total}
            filters={filters}
          />
        </CardContent>
      </Card>
    </div>
  )
}
