import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { getProductById } from "@/features/products/db/products"
import { getAllCategories } from "@/features/categories/db/categories"
import { getAllLaboratories } from "@/features/laboratory/db/laboratory"
import { getAllOrigins } from "@/features/origin/db/origin"
import PortalProductForm from "@/components/portal/PortalProductForm"

type Params = { params: Promise<{ id: string }> }

export default async function EditPortalProductPage({ params }: Params) {
  const { id } = await params
  const [session, product, categories, laboratories, origins] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    getProductById(id),
    getAllCategories(),
    getAllLaboratories(),
    getAllOrigins(),
  ])

  if (!product) notFound()
  // ownership guard — layout already enforces portal role
  if (product.sellerId !== session!.user.id) notFound()

  const initial = {
    title:            product.title,
    description:      product.description ?? "",
    productType:      product.productType as "loose_stone" | "jewellery",
    categoryId:       product.categoryId ?? "",
    price:            product.price,
    currency:         product.currency,
    isNegotiable:     product.isNegotiable,
    identification:   product.identification ?? "Natural",
    isFeatured:       product.isFeatured ?? false,
    isCollectorPiece: product.isCollectorPiece ?? false,
    isPrivilegeAssist: product.isPrivilegeAssist ?? false,
    weightCarat:      product.weightCarat ?? "",
    color:            product.color ?? "",
    origin:           product.origin ?? "",
    stoneCut:         product.stoneCut ?? "",
    shape:            product.shape ?? "",
    dimensions:       product.dimensions ?? "",
    metal:            product.metal ?? "",
    totalWeightGrams: product.totalWeightGrams ?? "",
    pieceCount:       product.pieceCount != null ? String(product.pieceCount) : "",
    laboratoryId:     product.laboratoryId ?? "",
    certReportNumber: product.certReportNumber ?? "",
    certReportDate:   product.certReportDate ?? "",
    certReportUrl:    product.certReportUrl ?? "",
    additionalMemos:  product.additionalMemos ?? "",
    imageUrls:        product.imageUrls,
    videoUrls:        product.videoUrls,
    jewelleryGemstones: (product.jewelleryGemstones ?? []).map((g) => ({
      categoryId:   g.categoryId,
      weightCarat:  g.weightCarat,
      pieceCount:   g.pieceCount != null ? String(g.pieceCount) : "",
      dimensions:   g.dimensions ?? "",
      color:        g.color ?? "",
      shape:        g.shape ?? "",
      origin:       g.origin ?? "",
      cut:          g.cut ?? "",
      transparency: g.transparency ?? "",
      comment:      g.comment ?? "",
      inclusions:   g.inclusions ?? "",
    })),
  }

  return (
    <PortalProductForm
      mode="edit"
      categories={categories}
      laboratories={laboratories}
      origins={origins}
      productId={id}
      initial={initial}
      backHref="/portal/products"
    />
  )
}
