import Link from "next/link"
import { connection } from "next/server"
import { Suspense } from "react"
import { Plus } from "lucide-react"
import { getAdminProducts } from "@/features/products/db/cache/products"
import {
  ProductFilters,
  ProductsSearchInput,
  ProductsTable,
} from "@/features/products/components"
import { Button } from "@/components/ui/button"
import {
  adminProductsSearchSchema,
  ADMIN_PRODUCTS_PAGE_SIZE,
} from "@/features/products/schemas/products"
import { getAllCategories } from "@/features/categories/db/categories"
import { getAllLaboratories } from "@/features/laboratory/db/laboratory"
import { getAllOrigins } from "@/features/origin/db/origin"

type Props = {
  searchParams: Promise<{
    page?: string; search?: string; productType?: string; categoryId?: string
    status?: string; stoneCut?: string; shape?: string; origin?: string
    laboratoryId?: string; createdFrom?: string; createdTo?: string
    sortBy?: string; sortOrder?: string; isFeatured?: string
    isCollectorPiece?: string; isPrivilegeAssist?: string; isPromotion?: string
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
    isPromotion: params.isPromotion,
  })

  const categories = await getAllCategories()
  const origins = await getAllOrigins()
  const laboratories = await getAllLaboratories()

  const limit = ADMIN_PRODUCTS_PAGE_SIZE
  const { products, total } = await getAdminProducts({
    page: parsed.page,
    limit,
    search: parsed.search || undefined,
    productType: parsed.productType ?? undefined,
    categoryId: parsed.categoryId ?? undefined,
    status: parsed.status ?? undefined,
    stoneCut: parsed.stoneCut ?? undefined,
    shape: parsed.shape ?? undefined,
    origin: (parsed.origin?.trim() && parsed.origin) || undefined,
    laboratoryId: parsed.laboratoryId ?? undefined,
    createdFrom: parsed.createdFrom ?? undefined,
    createdTo: parsed.createdTo ?? undefined,
    sortBy: parsed.sortBy ?? undefined,
    sortOrder: parsed.sortOrder ?? undefined,
    isFeatured: parsed.isFeatured ?? undefined,
    isCollectorPiece: parsed.isCollectorPiece ?? undefined,
    isPrivilegeAssist: parsed.isPrivilegeAssist ?? undefined,
    isPromotion: parsed.isPromotion ?? undefined,
  })

  const totalPages = Math.ceil(total / limit)
  const filters = {
    search: parsed.search ?? "",
    productType: parsed.productType ?? "",
    categoryId: parsed.categoryId ?? "",
    status: parsed.status ?? "",
    stoneCut: parsed.stoneCut ?? "",
    shape: parsed.shape ?? "",
    origin: parsed.origin ?? "",
    laboratoryId: parsed.laboratoryId ?? "",
    createdFrom: parsed.createdFrom ?? "",
    createdTo: parsed.createdTo ?? "",
    sortBy: parsed.sortBy ?? "createdAt",
    sortOrder: parsed.sortOrder ?? "desc",
    isFeatured: parsed.isFeatured === true ? "true" : "",
    isCollectorPiece: parsed.isCollectorPiece === true ? "true" : "",
    isPrivilegeAssist: parsed.isPrivilegeAssist === true ? "true" : "",
    isPromotion: parsed.isPromotion === true ? "true" : "",
  }

  return (
    <div className="gem-theme space-y-5 py-2">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Products</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Gemstones &amp; jewellery — manage listings, moderation, and status
          </p>
        </div>
        <Button asChild size="sm" className="shrink-0 shadow-sm">
          <Link href="/admin/products/new">
            <Plus className="mr-1.5 size-4" />
            New Product
          </Link>
        </Button>
      </div>

      {/* Table card: search bar + table together */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/60">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
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
              isPromotion={filters.isPromotion === "true"}
            />
          </Suspense>
          <span className="ml-auto text-xs text-slate-400">
            {total.toLocaleString()} product{total !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Table (no extra shell since we're already in the card) */}
        <div className="overflow-x-auto">
          <ProductsTable
            products={products}
            page={parsed.page}
            totalPages={totalPages}
            total={total}
            filters={filters}
          />
        </div>
      </div>
    </div>
  )
}
