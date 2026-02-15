import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { jsonUncached, jsonError } from "@/lib/api"
import { getProductsBySellerId } from "@/features/products/db/products"
import { adminProductsSearchSchema } from "@/features/products/schemas/products"

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const { searchParams } = new URL(request.url)
    const parsed = adminProductsSearchSchema.safeParse({
      page: searchParams.get("page"),
      search: searchParams.get("search"),
    })
    const { page, search } = parsed.success ? parsed.data : { page: 1, search: undefined }
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 100)

    const { products, total } = await getProductsBySellerId(session.user.id, {
      page,
      limit,
      search: search ?? undefined,
    })

    return jsonUncached({ products, total })
  } catch (error) {
    console.error("GET /api/products/mine:", error)
    return jsonError("Failed to fetch products", 500)
  }
}
