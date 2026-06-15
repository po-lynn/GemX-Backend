import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { getProductById } from "@/features/products/db/products"
import { getAllCategories } from "@/features/categories/db/categories"
import PortalProductForm from "@/components/portal/PortalProductForm"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

type Params = { params: Promise<{ id: string }> }

export default async function EditPortalProductPage({ params }: Params) {
  const { id } = await params
  const [session, product, categories] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    getProductById(id),
    getAllCategories(),
  ])

  if (!product) notFound()
  // ownership guard — layout already enforces portal role
  if (product.sellerId !== session!.user.id) notFound()

  const initial = {
    title:            product.title,
    sku:              product.sku ?? "",
    description:      product.description ?? "",
    productType:      product.productType,
    categoryId:       product.categoryId ?? "",
    price:            product.price,
    currency:         product.currency,
    isNegotiable:     product.isNegotiable,
    identification:   product.identification ?? "Natural",
    weightCarat:      product.weightCarat ?? "",
    color:            product.color ?? "",
    origin:           product.origin ?? "",
    stoneCut:         product.stoneCut ?? "",
    shape:            product.shape ?? "",
    dimensions:       product.dimensions ?? "",
    metal:            product.metal ?? "",
    totalWeightGrams: product.totalWeightGrams ?? "",
    pieceCount:       product.pieceCount != null ? String(product.pieceCount) : "",
    certReportNumber: product.certReportNumber ?? "",
    certReportDate:   product.certReportDate ?? "",
    certReportUrl:    product.certReportUrl ?? "",
    additionalMemos:  product.additionalMemos ?? "",
    imageUrls:        product.imageUrls.join("\n"),
    videoUrls:        product.videoUrls.join("\n"),
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/portal/products"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          My products
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Edit product</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Changes will go back into review before publishing.</p>
      </div>
      <PortalProductForm categories={categories} productId={id} initial={initial} />
    </div>
  )
}
