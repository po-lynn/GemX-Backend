import { NextRequest, connection } from "next/server"
import { auth } from "@/lib/auth"
import { jsonCached, jsonError } from "@/lib/api"
import { getUserById } from "@/features/users/db/users"
import { getCachedProductsBySellerId } from "@/features/products/db/cache/products"
import { adminProductsSearchSchema } from "@/features/products/schemas/products"
import type { z } from "zod"

export async function GET(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const userId = session.user.id

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
      stoneCut,
      shape,
      origin,
      laboratoryId,
    } = data
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 100)

    const user = await getUserById(userId)
    if (!user) return jsonError("Profile not found", 404)

    const { products, total } = await getCachedProductsBySellerId(userId, {
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
    })

    const profile = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      username: user.username,
      displayUsername: user.displayUsername,
      nrc: user.nrc,
      address: user.address,
      city: user.city,
      state: user.state,
      country: user.country,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      points: user.points,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }

    return jsonCached({
      profile,
      products: { products, total },
    })
  } catch (error) {
    console.error("GET /api/profile:", error)
    return jsonError("Failed to fetch profile", 500)
  }
}
