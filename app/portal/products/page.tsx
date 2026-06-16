import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getProductsBySellerId } from "@/features/products/db/products"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Package } from "lucide-react"
import PortalProductActions from "@/components/portal/PortalProductActions"

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active:  { label: "Active",   variant: "default" },
  pending: { label: "Pending",  variant: "secondary" },
  hidden:  { label: "Hidden",   variant: "outline" },
  archive: { label: "Archived", variant: "outline" },
  sold:    { label: "Sold",     variant: "outline" },
}

const MOD_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending:  { label: "Under Review", variant: "secondary" },
  approved: { label: "Approved",     variant: "default" },
  rejected: { label: "Rejected",     variant: "destructive" },
}

export default async function PortalProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page) || 1)
  const session = await auth.api.getSession({ headers: await headers() })
  const userId = session!.user.id

  const { products, total } = await getProductsBySellerId(userId, {
    page,
    limit: 20,
    sortBy: "createdAt",
    sortOrder: "desc",
  })

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">My Products</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{total} product{total !== 1 ? "s" : ""} total</p>
        </div>
        <Button asChild size="sm">
          <Link href="/portal/products/new">
            <Plus className="mr-1.5 h-4 w-4" />
            New product
          </Link>
        </Button>
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <Package className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No products yet</p>
          <p className="mt-1 text-xs text-muted-foreground/70">Create your first product listing to get started.</p>
          <Button asChild size="sm" className="mt-4">
            <Link href="/portal/products/new">
              <Plus className="mr-1.5 h-4 w-4" />
              Create product
            </Link>
          </Button>
        </div>
      ) : (
        <div className="divide-y rounded-xl border bg-card shadow-sm">
          {products.map((product) => {
            const status = STATUS_BADGE[product.status] ?? { label: product.status, variant: "outline" as const }
            const mod = MOD_BADGE[product.moderationStatus] ?? { label: product.moderationStatus, variant: "secondary" as const }
            return (
              <div key={product.id} className="flex items-center gap-4 px-5 py-4">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt=""
                    width={48}
                    height={48}
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Package className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{product.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {product.currency} {Number(product.price).toLocaleString()}
                    {" · "}
                    {product.productType === "loose_stone" ? "Loose Stone" : "Jewellery"}
                  </p>
                </div>
                <div className="hidden shrink-0 items-center gap-2 sm:flex">
                  <Badge variant={status.variant}>{status.label}</Badge>
                  <Badge variant={mod.variant}>{mod.label}</Badge>
                </div>
                <PortalProductActions productId={product.id} />
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          {page > 1 && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/portal/products?page=${page - 1}`}>Previous</Link>
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/portal/products?page=${page + 1}`}>Next</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
