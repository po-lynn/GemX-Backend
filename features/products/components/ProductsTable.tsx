"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { formatDate, formatPriceWithCurrency } from "@/lib/formatters"
import { ProductRowActions } from "@/features/products/components/ProductRowActions"
import type { AdminProductRow } from "@/features/products/db/products"
import {
  AdminPagination,
  AdminStatusBadge,
  adminTH,
  adminTHRight,
  adminTRClickable,
  adminTD,
  AdminEmptyRow,
} from "@/components/admin/admin-ui"

export type AdminProductFilters = {
  search: string
  productType: string
  categoryId: string
  status: string
  stoneCut: string
  shape: string
  origin: string
  laboratoryId: string
  createdFrom: string
  createdTo: string
  sortBy: string
  sortOrder: string
  isFeatured: string
  isCollectorPiece: string
  isPrivilegeAssist: string
  isPromotion: string
}

type Props = {
  products: AdminProductRow[]
  page: number
  totalPages: number
  total: number
  filters: AdminProductFilters
  listPath?: string
  editBasePath?: string
}

function buildQueryString(page: number, filters: AdminProductFilters): string {
  const sp = new URLSearchParams()
  sp.set("page", String(page))
  const setIf = (key: string, value: string) => {
    if (value?.trim()) sp.set(key, value.trim())
  }
  setIf("search", filters.search)
  setIf("productType", filters.productType)
  setIf("categoryId", filters.categoryId)
  setIf("status", filters.status)
  setIf("stoneCut", filters.stoneCut)
  setIf("shape", filters.shape)
  setIf("origin", filters.origin)
  setIf("laboratoryId", filters.laboratoryId)
  setIf("createdFrom", filters.createdFrom)
  setIf("createdTo", filters.createdTo)
  if (filters.isFeatured === "true") sp.set("isFeatured", "true")
  if (filters.isCollectorPiece === "true") sp.set("isCollectorPiece", "true")
  if (filters.isPrivilegeAssist === "true") sp.set("isPrivilegeAssist", "true")
  if (filters.isPromotion === "true") sp.set("isPromotion", "true")
  sp.set("sortBy", filters.sortBy?.trim() || "createdAt")
  sp.set("sortOrder", filters.sortOrder?.trim() || "desc")
  return sp.toString()
}

function promotionSavingsAmount(p: AdminProductRow): number | null {
  if (!p.isPromotion || p.promotionComparePrice == null || p.promotionComparePrice === "")
    return null
  const compare = Number(p.promotionComparePrice)
  const sale = Number(p.price)
  if (!Number.isFinite(compare) || !Number.isFinite(sale)) return null
  const save = compare - sale
  return save > 0 ? save : null
}

type SortCol = "title" | "price" | "status" | "createdAt"

function SortableHeader({
  column,
  label,
  isActive,
  sortOrder,
  onSort,
}: {
  column: SortCol
  label: string
  isActive: boolean
  sortOrder: string
  onSort: (column: SortCol) => void
}) {
  return (
    <th className={adminTH}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onSort(column) }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSort(column) }
        }}
        className="group inline-flex h-full w-full items-center gap-1.5 rounded text-left transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label={
          isActive
            ? `Sort by ${label} ${sortOrder === "asc" ? "ascending" : "descending"}`
            : `Sort by ${label}`
        }
      >
        {label}
        <span className="inline-flex shrink-0 items-center text-slate-400">
          {isActive ? (
            sortOrder === "asc" ? (
              <ArrowUp className="size-3" />
            ) : (
              <ArrowDown className="size-3" />
            )
          ) : (
            <ArrowUpDown className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
          )}
        </span>
      </button>
    </th>
  )
}

export function ProductsTable({
  products,
  page,
  totalPages,
  total,
  filters,
  listPath = "/admin/products",
  editBasePath = "/admin/products",
}: Props) {
  const router = useRouter()
  const listBase = listPath.replace(/\/$/, "")
  const editBase = editBasePath.replace(/\/$/, "")

  const currentSortBy = filters.sortBy?.trim() || "createdAt"
  const currentSortOrder = filters.sortOrder?.trim() || "desc"

  function handleSort(column: SortCol) {
    const nextOrder =
      currentSortBy === column
        ? currentSortOrder === "asc" ? "desc" : "asc"
        : "asc"
    router.push(`${listBase}?${buildQueryString(1, { ...filters, sortBy: column, sortOrder: nextOrder })}`)
  }

  function buildHref(p: number) {
    return `${listBase}?${buildQueryString(p, filters)}`
  }

  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80">
            <SortableHeader column="title" label="Product" isActive={currentSortBy === "title"} sortOrder={currentSortOrder} onSort={handleSort} />
            <th className={adminTH}>Type</th>
            <SortableHeader column="price" label="Price" isActive={currentSortBy === "price"} sortOrder={currentSortOrder} onSort={handleSort} />
            <SortableHeader column="status" label="Status" isActive={currentSortBy === "status"} sortOrder={currentSortOrder} onSort={handleSort} />
            <th className={adminTH}>Moderation</th>
            <th className={adminTH}>Flags</th>
            <th className={adminTH}>Seller</th>
            <SortableHeader column="createdAt" label="Created" isActive={currentSortBy === "createdAt"} sortOrder={currentSortOrder} onSort={handleSort} />
            <th className={adminTHRight}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.length === 0 ? (
            <AdminEmptyRow colSpan={9} message="No products found. Try adjusting your filters." />
          ) : (
            products.map((p) => (
              <tr
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`${editBase}/${p.id}/edit`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    router.push(`${editBase}/${p.id}/edit`)
                  }
                }}
                className={adminTRClickable}
              >
                {/* Product */}
                <td className={adminTD}>
                  <div className="flex items-center gap-3">
                    {p.imageUrl ? (
                      <Image
                        src={p.imageUrl}
                        alt=""
                        width={40}
                        height={40}
                        className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-slate-200/60"
                      />
                    ) : (
                      <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-100 ring-1 ring-slate-200/60" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate max-w-[200px] font-medium text-slate-800">
                        {p.title}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Type */}
                <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                  <span className="capitalize">
                    {p.productType === "loose_stone" ? "Loose stone" : "Jewellery"}
                    {p.categoryName ? ` · ${p.categoryName}` : ""}
                  </span>
                </td>

                {/* Price */}
                <td className={adminTD}>
                  <div className="font-medium tabular-nums text-slate-800">
                    {formatPriceWithCurrency(Number(p.price), p.currency)}
                  </div>
                  {(() => {
                    const save = promotionSavingsAmount(p)
                    return save != null ? (
                      <div className="mt-0.5 text-[11px] font-medium text-emerald-600">
                        Save {formatPriceWithCurrency(save, p.currency)}
                      </div>
                    ) : null
                  })()}
                </td>

                {/* Status */}
                <td className={adminTD}>
                  <AdminStatusBadge status={p.status} />
                </td>

                {/* Moderation */}
                <td className={adminTD}>
                  <AdminStatusBadge status={p.moderationStatus} />
                </td>

                {/* Flags */}
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {p.isFeatured && <AdminStatusBadge status="featured" label="Featured" />}
                    {p.isPromotion && <AdminStatusBadge status="promotion" label="Promo" />}
                    {p.isCollectorPiece && <AdminStatusBadge status="collector" label="Collector" />}
                    {p.isPrivilegeAssist && <AdminStatusBadge status="privilege" label="Privilege" />}
                    {!p.isFeatured && !p.isPromotion && !p.isCollectorPiece && !p.isPrivilegeAssist && (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </div>
                </td>

                {/* Seller */}
                <td className={adminTD}>
                  <div className="font-medium text-slate-800">{p.sellerName}</div>
                  {p.sellerPhone && (
                    <div className="text-xs text-slate-500">{p.sellerPhone}</div>
                  )}
                </td>

                {/* Created */}
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                  {formatDate(p.createdAt)}
                </td>

                {/* Actions */}
                <td
                  className="px-4 py-3 text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ProductRowActions productId={p.id} productTitle={p.title} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <AdminPagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageCount={products.length}
        buildHref={buildHref}
      />
    </>
  )
}
