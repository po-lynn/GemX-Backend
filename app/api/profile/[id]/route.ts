import { NextRequest, connection } from "next/server"
import { jsonCached, jsonError } from "@/lib/api"
import { getUserById } from "@/features/users/db/users"
import { getCachedProductsBySellerId } from "@/features/products/db/cache/products"
import { adminProductsSearchSchema } from "@/features/products/schemas/products"
import type { z } from "zod"

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  await connection()
  try {
    const { id } = await params
    if (!id?.trim()) return jsonError("Profile not found", 404)

    const user = await getUserById(id)
    if (!user || user.archived) return jsonError("Profile not found", 404)

    const { searchParams } = new URL(request.url)
    const parsed = adminProductsSearchSchema.safeParse({
      page: searchParams.get("page") || undefined,
      search: searchParams.get("search") || undefined,
      productType: searchParams.get("productType") || undefined,
      categoryId: searchParams.get("categoryId") || undefined,
      stoneCut: searchParams.get("stoneCut") || undefined,
      shape: searchParams.get("shape") || undefined,
      origin: searchParams.get("origin") || undefined,
      laboratoryId: searchParams.get("laboratoryId") || undefined,
      isCollectorPiece: searchParams.get("isCollectorPiece") || undefined,
      isPrivilegeAssist: searchParams.get("isPrivilegeAssist") || undefined,
      isPromotion: searchParams.get("isPromotion") || undefined,
    })
    type SearchParams = z.infer<typeof adminProductsSearchSchema>
    const data: SearchParams = (parsed.success ? parsed.data : { page: 1 }) as SearchParams
    const {
      page = 1,
      search,
      productType,
      categoryId,
      stoneCut,
      shape,
      origin,
      laboratoryId,
      isCollectorPiece,
      isPrivilegeAssist,
      isPromotion,
    } = data
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 100)

    const { products, total } = await getCachedProductsBySellerId(id, {
      page,
      limit,
      search: search ?? undefined,
      productType: productType ?? undefined,
      categoryId: categoryId ?? undefined,
      status: "active",
      stoneCut: stoneCut ?? undefined,
      shape: shape ?? undefined,
      origin: origin ?? undefined,
      laboratoryId: laboratoryId ?? undefined,
      isCollectorPiece: isCollectorPiece === true ? true : undefined,
      isPrivilegeAssist: isPrivilegeAssist === true ? true : undefined,
      isPromotion: isPromotion === true ? true : undefined,
    })

    const profile = {
      id: user.id,
      name: user.name,
      image: user.image,
      username: user.username,
      displayUsername: user.displayUsername,
      createdAt: user.createdAt,
    }

    return jsonCached({
      profile,
      products: { products, total },
    })
  } catch (error) {
    console.error("GET /api/profile/[id]:", error)
    return jsonError("Failed to fetch public profile", 500)
  }
}

