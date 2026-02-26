import Link from "next/link"
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
  return sp.toString()
}

export function ProductsTable({
  products,
  page,
  totalPages,
  total,
  filters,
}: Props) {
  const base = "/admin/products"
  const query = (p: number) => buildQueryString(p, filters)
  const pageNumbers = getPageNumbers(page, totalPages)

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="h-10 px-4 text-left font-medium">Product</th>
              <th className="h-10 px-4 text-left font-medium">Type</th>
              <th className="h-10 px-4 text-left font-medium">Price</th>
              <th className="h-10 px-4 text-left font-medium">Status</th>
              <th className="h-10 px-4 text-left font-medium">Moderation</th>
              <th className="h-10 px-4 text-left font-medium">Seller</th>
              <th className="h-10 px-4 text-left font-medium">Created</th>
              <th className="h-10 px-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="h-24 px-4 text-center text-muted-foreground"
                >
                  No products found
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt=""
                          className="h-10 w-10 rounded-md object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-md bg-muted" />
                      )}
                      <div>
                        <div className="font-medium">{p.title}</div>
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
                    {(p.isFeatured || p.featured > 0) && (
                      <Badge className="ml-1" variant="outline">
                        Featured
                      </Badge>
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
                  <td className="px-4 py-3 text-right">
                    <ProductRowActions productId={p.id} productTitle={p.title} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(totalPages >= 1 || products.length > 0) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
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
