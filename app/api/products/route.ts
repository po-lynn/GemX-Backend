import { NextRequest, connection } from "next/server"
import { auth } from "@/lib/auth"
import { jsonCached, jsonUncached, jsonError } from "@/lib/api"
import { createProductInDb } from "@/features/products/db/products"
import {
  getAdminProducts,
  revalidateProductsCache,
} from "@/features/products/db/cache/products"
import { productCreateSchema } from "@/features/products/schemas/products"
import { adminProductsSearchSchema } from "@/features/products/schemas/products"
import type { z } from "zod"
import { normalizeProductBody } from "@/features/products/api/normalize-product-body"

export async function GET(request: NextRequest) {
  await connection()
  try {
    const { searchParams } = new URL(request.url)
    const parsed = adminProductsSearchSchema.safeParse({
      page: searchParams.get("page") || undefined,
      search: searchParams.get("search") || undefined,
      productType: searchParams.get("productType") || undefined,
      categoryId: searchParams.get("categoryId") || undefined,
      status: searchParams.get("status") || undefined,
      stoneCut: searchParams.get("stoneCut") || undefined,
      shape: searchParams.get("shape") || undefined,
      origin: searchParams.get("origin") || undefined,
      laboratoryId: searchParams.get("laboratoryId") || undefined,
    })
    type SearchParams = z.infer<typeof adminProductsSearchSchema>
    const data: SearchParams = (parsed.success ? parsed.data : { page: 1 }) as SearchParams
    const {
      page = 1,
      search,
      productType,
      categoryId,
      status,
      stoneCut,
      shape,
      origin,
      laboratoryId,
    } = data
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 100)
    const { products, total } = await getAdminProducts({
      page,
      limit,
      search: search ?? undefined,
      productType: productType ?? undefined,
      categoryId: categoryId ?? undefined,
      status: status ?? undefined,
      stoneCut: stoneCut ?? undefined,
      shape: shape ?? undefined,
      origin: origin ?? undefined,
      laboratoryId: laboratoryId ?? undefined,
    })
    return jsonCached({ products, total })
  } catch (error) {
    console.error("GET /api/products:", error)
    return jsonError("Failed to fetch products", 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return jsonError("Unauthorized", 401)
    }
    const body = await request.json().catch(() => ({}))
    const normalized = normalizeProductBody(body)
    const parsed = productCreateSchema.safeParse(normalized)
    if (!parsed.success) {
      const flat = parsed.error.flatten()
      const msg =
        flat.formErrors.join(", ") ||
        Object.entries(flat.fieldErrors)
          .map(([k, v]) => `${k}: ${(v as string[])?.[0] ?? "invalid"}`)
          .join(", ") ||
        "Invalid input"
      return Response.json(
        { error: msg, details: flat.fieldErrors },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }
    const productId = await createProductInDb({
      ...parsed.data,
      sellerId: session.user.id,
    })
    revalidateProductsCache(productId)
    return jsonUncached({ success: true, productId }, { status: 201 })
  } catch (error) {
    console.error("POST /api/products:", error)
    return jsonError("Failed to create product", 500)
  }
}
