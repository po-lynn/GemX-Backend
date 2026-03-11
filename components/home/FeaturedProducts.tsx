import Link from "next/link"
import type { AdminProductRow } from "@/features/products/db/products"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight } from "lucide-react"

function formatPrice(price: string, currency: string) {
  const n = Number(price)
  if (currency === "MMK") return `${n.toLocaleString()} MMK`
  return `$${Number(price).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function FeaturedProducts({ products }: { products: AdminProductRow[] }) {
  if (products.length === 0) {
    return (
      <section id="featured" className="border-t border-border bg-muted/20 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Featured pieces
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            No listings yet. Check back soon for certified gemstones and jewellery.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section id="featured" className="border-t border-border bg-muted/20 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Featured pieces
            </h2>
            <p className="mt-2 text-muted-foreground">
              Handpicked certified gemstones and fine jewellery from trusted sellers.
            </p>
          </div>
          <Button variant="outline" className="w-fit gap-2 rounded-full" asChild>
            <Link href="/admin/products">
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.slice(0, 8).map((product) => (
            <Link key={product.id} href={`/admin/products?highlight=${product.id}`}>
              <Card className="group h-full overflow-hidden border-border/80 bg-card transition-all duration-200 hover:border-primary/30 hover:shadow-lg">
                <div className="relative aspect-square overflow-hidden bg-muted">
                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <span className="text-sm">No image</span>
                    </div>
                  )}
                  <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                    {product.isCollectorPiece && (
                      <Badge className="bg-amber-500/90 text-white border-0">Collector</Badge>
                    )}
                    {product.isFeatured && (
                      <Badge variant="secondary">Featured</Badge>
                    )}
                  </div>
                </div>
                <CardContent className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {product.categoryName ?? product.productType}
                  </p>
                  <h3 className="mt-1 font-semibold text-foreground line-clamp-2 group-hover:text-primary">
                    {product.title}
                  </h3>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {formatPrice(product.price, product.currency)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
