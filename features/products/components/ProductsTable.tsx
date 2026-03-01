"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { formatDate, formatPriceWithCurrency } from "@/lib/formatters"
import { ELLIPSIS_NEXT, ELLIPSIS_PREV, getPageNumbers } from "@/lib/pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ProductRowActions } from "@/features/products/components/ProductRowActions"
import type { AdminProductRow } from "@/features/products/db/products"

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
}

type Props = {
  products: AdminProductRow[]
  page: number
  totalPages: number
  total: number
  filters: AdminProductFilters
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
  sp.set("sortBy", filters.sortBy?.trim() || "createdAt")
  sp.set("sortOrder", filters.sortOrder?.trim() || "desc")
  return sp.toString()
}

export function ProductsTable({
  products,
  page,
  totalPages,
  total,
  filters,
}: Props) {
  const router = useRouter()
  const base = "/admin/products"
  const query = (p: number) => buildQueryString(p, filters)
  const pageNumbers = getPageNumbers(page, totalPages)

  const currentSortBy = filters.sortBy?.trim() || "createdAt"
  const currentSortOrder = filters.sortOrder?.trim() || "desc"

  const handleHeaderSort = (column: "title" | "price" | "status" | "createdAt") => {
    const nextOrder =
      currentSortBy === column
        ? currentSortOrder === "asc"
          ? "desc"
          : "asc"
        : "asc"
    const next = { ...filters, sortBy: column, sortOrder: nextOrder }
    router.push(`${base}?${buildQueryString(1, next)}`)
  }

  const thSortableClass =
    "h-11 px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
  const thButtonClass =
    "group inline-flex h-full w-full items-center gap-1.5 rounded text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"

  const SortableHeader = ({
    column,
    label,
  }: {
    column: "title" | "price" | "status" | "createdAt"
    label: string
  }) => {
    const isActive = currentSortBy === column
    return (
      <th className={thSortableClass}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleHeaderSort(column)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              handleHeaderSort(column)
            }
          }}
          className={thButtonClass}
          aria-label={
            isActive
              ? `Sort by ${label} ${currentSortOrder === "asc" ? "ascending" : "descending"}, click to toggle`
              : `Sort by ${label} ascending`
          }
        >
          {label}
          <span className="inline-flex shrink-0 items-center">
            {isActive ? (
              currentSortOrder === "asc" ? (
                <ArrowUp className="size-3.5" aria-hidden />
              ) : (
                <ArrowDown className="size-3.5" aria-hidden />
              )
            ) : (
              <ArrowUpDown
                className="size-3.5 opacity-0 transition-opacity group-hover:opacity-70"
                aria-hidden
              />
            )}
          </span>
        </button>
      </th>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <SortableHeader column="title" label="Product" />
              <th className="h-11 px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
              <SortableHeader column="price" label="Price" />
              <SortableHeader column="status" label="Status" />
              <th className="h-11 px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Moderation</th>
              <th className="h-11 px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Collector</th>
              <th className="h-11 px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Privilege Assist</th>
              <th className="h-11 px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Seller</th>
              <SortableHeader column="createdAt" label="Created" />
              <th className="h-11 px-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="h-28 px-4 text-center text-muted-foreground"
                >
                  No products found
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`${base}/${p.id}/edit`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      router.push(`${base}/${p.id}/edit`)
                    }
                  }}
                  className="gem-table-row-hover cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt=""
                          className="h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-border/50"
                        />
                      ) : (
                        <div className="h-11 w-11 shrink-0 rounded-lg bg-muted ring-1 ring-border/50" />
                      )}
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{p.title}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="capitalize">
                      {p.productType === "loose_stone" ? "Loose stone" : "Jewellery"}
                      {p.categoryName ? ` / ${p.categoryName}` : ""}
                      {p.productType === "loose_stone" && p.stoneCut ? ` / ${p.stoneCut}` : ""}
                      {p.productType === "jewellery" && p.metal ? ` / ${p.metal}` : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {formatPriceWithCurrency(Number(p.price), p.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        p.status === "active"
                          ? "default"
                          : p.status === "archive"
                            ? "secondary"
                            : p.status === "sold"
                              ? "secondary"
                              : "outline"
                      }
                    >
                      {p.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        p.moderationStatus === "approved"
                          ? "default"
                          : p.moderationStatus === "rejected"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {p.moderationStatus}
                    </Badge>
                    {p.isFeatured && (
                      <Badge className="ml-1" variant="outline">
                        Featured
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.isCollectorPiece ? (
                      <Badge variant="secondary" className="gem-badge-collector border font-medium">Collector</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.isPrivilegeAssist ? (
                      <Badge variant="secondary">Privilege Assist</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium">{p.sellerName}</div>
                      {p.sellerPhone && (
                        <div className="text-muted-foreground text-xs">
                          {p.sellerPhone}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(p.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <ProductRowActions productId={p.id} productTitle={p.title} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(totalPages >= 1 || products.length > 0) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-border px-4 pt-4">
          <p className="text-muted-foreground text-sm">
            Page {page} of {totalPages || 1}
            {total > 0 && (
              <span className="ml-2">
                (showing {products.length} of {total})
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            {page <= 1 ? (
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link href={`${base}?${query(page - 1)}`}>Previous</Link>
              </Button>
            )}
            {pageNumbers.map((p) =>
              p === ELLIPSIS_PREV || p === ELLIPSIS_NEXT ? (
                <span key={p} className="px-1 text-muted-foreground">
                  …
                </span>
              ) : (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                  asChild
                >
                  <Link href={`${base}?${query(p)}`}>{p}</Link>
                </Button>
              )
            )}
            {page >= totalPages ? (
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link href={`${base}?${query(page + 1)}`}>Next</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
