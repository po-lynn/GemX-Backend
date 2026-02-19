import Link from "next/link"
import { formatDate, formatPriceWithCurrency } from "@/lib/formatters"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ProductRowActions } from "@/features/products/components/ProductRowActions"
import type { AdminProductRow } from "@/features/products/db/products"

type Props = {
  products: AdminProductRow[]
  page: number
  totalPages: number
  search: string
  productType?: string
  categoryId?: string
  status?: string
  stoneCut?: string
  shape?: string
  origin?: string
  laboratoryId?: string
}

function buildQueryString(params: {
  page: number
  search?: string
  productType?: string
  categoryId?: string
  status?: string
  stoneCut?: string
  shape?: string
  origin?: string
  laboratoryId?: string
}): string {
  const sp = new URLSearchParams()
  sp.set("page", String(params.page))
  if (params.search?.trim()) sp.set("search", params.search.trim())
  if (params.productType?.trim()) sp.set("productType", params.productType.trim())
  if (params.categoryId?.trim()) sp.set("categoryId", params.categoryId.trim())
  if (params.status?.trim()) sp.set("status", params.status.trim())
  if (params.stoneCut?.trim()) sp.set("stoneCut", params.stoneCut.trim())
  if (params.shape?.trim()) sp.set("shape", params.shape.trim())
  if (params.origin?.trim()) sp.set("origin", params.origin.trim())
  if (params.laboratoryId?.trim()) sp.set("laboratoryId", params.laboratoryId.trim())
  return sp.toString()
}

export function ProductsTable({
  products,
  page,
  totalPages,
  search,
  productType = "",
  categoryId = "",
  status = "",
  stoneCut = "",
  shape = "",
  origin = "",
  laboratoryId = "",
}: Props) {
  const base = "/admin/products"
  const query = (p: number) =>
    buildQueryString({
      page: p,
      search,
      productType,
      categoryId,
      status,
      stoneCut,
      shape,
      origin,
      laboratoryId,
    })
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
              <th className="h-10 px-4 text-right font-medium">Actions</th>
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

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild disabled={page <= 1}>
              <Link href={page <= 1 ? "#" : `${base}?${query(page - 1)}`}>
                Previous
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              disabled={page >= totalPages}
            >
              <Link
                href={page >= totalPages ? "#" : `${base}?${query(page + 1)}`}
              >
                Next
              </Link>
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
