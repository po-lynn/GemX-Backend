import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { jsonCached, jsonUncached, jsonError } from "@/lib/api"
import { canAdminManageProducts } from "@/features/products/permissions/products"
import {
  updateProductInDb,
  deleteProductInDb,
} from "@/features/products/db/products"
import {
  getCachedProduct,
  revalidateProductsCache,
} from "@/features/products/db/cache/products"
import { productUpdateSchema } from "@/features/products/schemas/products"
import { normalizeProductBody } from "@/features/products/api/normalize-product-body"

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const product = await getCachedProduct(id)
    if (!product) return jsonError("Product not found", 404)
    return jsonCached(product)
  } catch (error) {
    console.error("GET /api/products/[id]:", error)
    return jsonError("Failed to fetch product", 500)
  }
}

function canEditProduct(session: { user: { id: string; role: string } }, sellerId: string) {
  return session.user.id === sellerId || canAdminManageProducts(session.user.role)
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)
    const { id } = await params
    const product = await getCachedProduct(id)
    if (!product) return jsonError("Product not found", 404)
    if (!canEditProduct(session, product.sellerId)) {
      return jsonError("Forbidden", 403)
    }
    const body = await request.json().catch(() => ({}))
    const normalized = { ...normalizeProductBody(body), productId: id }
    const parsed = productUpdateSchema.safeParse(normalized)
    if (!parsed.success) {
      const msg = parsed.error.flatten().formErrors.join(", ") || "Invalid input"
      return jsonError(msg, 400)
    }
    const { productId, ...data } = parsed.data
    await updateProductInDb(productId, {
      title: data.title,
      sku: data.sku,
      description: data.description,
      price: data.price,
      currency: data.currency,
      isNegotiable: data.isNegotiable,
      productType: data.productType,
      categoryId: data.categoryId,
      stoneCut: data.stoneCut,
      metal: data.metal,
      materials: data.materials,
      qualityGemstones: data.qualityGemstones,
      jewelleryGemstones: data.jewelleryGemstones,
      totalWeightGrams: data.totalWeightGrams,
      weightCarat: data.weightCarat,
      dimensions: data.dimensions,
      color: data.color,
      shape: data.shape,
      treatment: data.treatment,
      origin: data.origin,
      laboratoryId: data.laboratoryId,
      certReportNumber: data.certReportNumber,
      certReportDate: data.certReportDate,
      certReportUrl: data.certReportUrl,
      status: data.status,
      isFeatured: data.isFeatured,
      imageUrls: data.imageUrls,
    })
    revalidateProductsCache(productId)
    return jsonUncached({ success: true, productId })
  } catch (error) {
    console.error("PATCH /api/products/[id]:", error)
    return jsonError("Failed to update product", 500)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth.api.getSession({ headers: _request.headers })
    if (!session) return jsonError("Unauthorized", 401)
    const { id } = await params
    const product = await getCachedProduct(id)
    if (!product) return jsonError("Product not found", 404)
    if (!canEditProduct(session, product.sellerId)) {
      return jsonError("Forbidden", 403)
    }
    const deleted = await deleteProductInDb(id)
    if (!deleted) return jsonError("Product not found", 404)
    revalidateProductsCache(id)
    return jsonUncached({ success: true })
  } catch (error) {
    console.error("DELETE /api/products/[id]:", error)
    return jsonError("Failed to delete product", 500)
  }
}
