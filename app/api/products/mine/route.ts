import { NextRequest, connection } from "next/server"
import { auth } from "@/lib/auth"
import { jsonCached, jsonError } from "@/lib/api"
import { getCachedProductsBySellerId } from "@/features/products/db/cache/products"
import { adminProductsSearchSchema } from "@/features/products/schemas/products"
import type { z } from "zod"

export async function GET(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

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

    const { products, total } = await getCachedProductsBySellerId(session.user.id, {
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
    console.error("GET /api/products/mine:", error)
    return jsonError("Failed to fetch products", 500)
  }
}
