import Link from "next/link"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { requireAdmin } from "@/lib/admin-guard"
import { Suspense } from "react"
import { ChevronLeft, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getCachedProductsBySellerId } from "@/features/products/db/cache/products"
import {
  ProductFilters,
  ProductsSearchInput,
  ProductsTable,
} from "@/features/products/components"
import {
  adminProductsSearchSchema,
  ADMIN_PRODUCTS_PAGE_SIZE,
} from "@/features/products/schemas/products"
import { getAllCategories } from "@/features/categories/db/categories"
import { getAllLaboratories } from "@/features/laboratory/db/laboratory"
import { getAllOrigins } from "@/features/origin/db/origin"
import { getUserById } from "@/features/users/db/users"

type Props = {
  params: Promise<{ id: string }>
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
    isPromotion?: string
  }>
}

export default async function AdminUserProductsPage({ params, searchParams }: Props) {
  await connection()
  await requireAdmin()
  const { id: userId } = await params
  const user = await getUserById(userId)
  if (!user || user.archived) notFound()

  const paramsQuery = await searchParams
  const parsed = adminProductsSearchSchema.parse({
    page: paramsQuery.page,
    search: paramsQuery.search,
    productType: paramsQuery.productType,
    categoryId: paramsQuery.categoryId,
    status: paramsQuery.status,
    stoneCut: paramsQuery.stoneCut,
    shape: paramsQuery.shape,
    origin: paramsQuery.origin,
    laboratoryId: paramsQuery.laboratoryId,
    createdFrom: paramsQuery.createdFrom?.trim() || undefined,
    createdTo: paramsQuery.createdTo?.trim() || undefined,
    sortBy: paramsQuery.sortBy,
    sortOrder: paramsQuery.sortOrder,
    isFeatured: paramsQuery.isFeatured,
    isCollectorPiece: paramsQuery.isCollectorPiece,
    isPrivilegeAssist: paramsQuery.isPrivilegeAssist,
    isPromotion: paramsQuery.isPromotion,
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
    isPromotion,
  } = parsed

  const categories = await getAllCategories()
  const origins = await getAllOrigins()
  const laboratories = await getAllLaboratories()

  const limit = ADMIN_PRODUCTS_PAGE_SIZE
  const { products, total } = await getCachedProductsBySellerId(userId, {
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
    isPromotion: isPromotion ?? undefined,
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
    isPromotion: isPromotion === true ? "true" : "",
  }

  const listPath = `/admin/users/${userId}/products`

  return (
    <div className="gem-theme container my-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2">
          <Button variant="ghost" size="icon" className="mt-0.5 shrink-0" asChild>
            <Link href="/admin/users">
              <ChevronLeft className="size-4" />
              <span className="sr-only">Back to users</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              User products
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Listings for{" "}
              <span className="font-medium text-foreground">{user.name}</span> ({user.email})
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/users/${userId}/edit`}>
            <Pencil className="mr-2 size-4" />
            Edit user
          </Link>
        </Button>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="space-y-4 border-b border-border pb-6">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-lg">Products</CardTitle>
            <CardDescription>
              {total} product{total !== 1 ? "s" : ""} for this seller
            </CardDescription>
          </div>
          <div className="gem-search-bar flex flex-wrap items-center gap-4 p-4">
            <Suspense fallback={null}>
              <ProductsSearchInput defaultValue={filters.search} listPath={listPath} />
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
                isPromotion={filters.isPromotion === "true"}
                listPath={listPath}
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
            listPath={listPath}
            editBasePath="/admin/products"
          />
        </CardContent>
      </Card>
    </div>
  )
}
